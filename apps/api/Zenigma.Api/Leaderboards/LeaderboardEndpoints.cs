using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Zenigma.Api.Auth;
using Zenigma.Api.Data;
using Zenigma.Api.Games.Puzzles;
using Zenigma.Api.Infrastructure;

namespace Zenigma.Api.Leaderboards;

/// <summary>One row of a leaderboard. The meaning of Value depends on the board (see <see cref="LeaderboardEndpoints"/>).</summary>
public class LeaderRow
{
    public string UserId { get; set; } = "";
    public string Name { get; set; } = "";
    public long Value { get; set; }
    public long Secondary { get; set; }
    public long Rank { get; set; }
}

public record LeaderEntryDto(long Rank, string Name, long Value, long Secondary, bool IsMe);

public record LeaderboardDto(string Game, string Kind, string Period, string? Date, List<LeaderEntryDto> Entries, LeaderEntryDto? Me);

public record DailyGameStatusDto(string Game, bool Available, string Status, int? ElapsedMs, int? Guesses, int? Rank);
public record DailyHubDto(string Date, DateTimeOffset NextRolloverUtc, List<DailyGameStatusDto> Games);

/// <summary>
/// Leaderboards per game.
///   kind=daily    period=today  Today's puzzle. Word Guess: fewest guesses, then fastest. Grid puzzles: fastest server-timed solve.
///   kind=daily    period=week|all  Most daily puzzles solved (Value), then least total time (Secondary, ms).
///   kind=practice period=week|all  Most distinct practice levels solved (Value). Checked for correctness, not timed.
/// Names are display names, or "Player" plus four characters when someone has not set one. Emails are never shown.
/// </summary>
public static class LeaderboardEndpoints
{
    private const int PageSize = 50;
    private static readonly string[] AllGames = ["word-guess", .. PuzzleRules.Games];

    private const string NameSql = """CASE WHEN u."HideName" THEN 'Player ' || upper(substr(md5(u."Id"), 1, 4)) ELSE COALESCE(NULLIF(u."DisplayName", ''), 'Player ' || upper(substr(md5(u."Id"), 1, 4))) END""";

    public static void MapLeaderboards(this IEndpointRouteBuilder app)
    {
        // The Daily tab: where today's four challenges stand for this player.
        app.MapGet("/daily", async (ClaimsPrincipal principal, AppDbContext db, TimeProvider clock, CancellationToken ct) =>
        {
            var now = clock.GetUtcNow();
            var date = IstClock.Today(now);
            var userId = UserIds.Get(principal);

            var scheduled = await db.DailyPuzzles.AsNoTracking().Where(p => p.PuzzleDate == date).Select(p => p.Game).ToListAsync(ct);
            var word = await db.DailyAttempts.AsNoTracking().FirstOrDefaultAsync(a => a.UserId == userId && a.Game == "word-guess" && a.PuzzleDate == date, ct);
            var grids = await db.PuzzleAttempts.AsNoTracking().Where(a => a.UserId == userId && a.PuzzleDate == date).ToListAsync(ct);

            var games = new List<DailyGameStatusDto>();
            foreach (var game in AllGames)
            {
                var available = scheduled.Contains(game);
                if (game == "word-guess")
                {
                    int? rank = null;
                    if (word is { Status: "won" } w)
                    {
                        var guesses = w.Guesses.Count;
                        var ms = (long)((w.FinishedAt ?? now) - (w.FirstGuessAt ?? w.StartedAt)).TotalMilliseconds;
                        var better = await db.Database.SqlQuery<int>($"""
                            SELECT COUNT(*)::int AS "Value" FROM daily_attempts a
                            WHERE a.game = 'word-guess' AND a.puzzle_date = {date} AND a.status = 'won'
                              AND (cardinality(a.guesses) < {guesses}
                                   OR (cardinality(a.guesses) = {guesses}
                                       AND EXTRACT(EPOCH FROM (a.finished_at - COALESCE(a.first_guess_at, a.started_at))) * 1000 < {ms}))
                            """).SingleAsync(ct);
                        rank = 1 + better;
                    }

                    games.Add(new DailyGameStatusDto(game, available, word?.Status ?? "new", null, word?.Guesses.Count, rank));
                }
                else
                {
                    var a = grids.FirstOrDefault(x => x.Game == game);
                    int? rank = null;
                    if (a is { Status: "solved", ElapsedMs: { } ms })
                    {
                        rank = 1 + await db.PuzzleAttempts.AsNoTracking()
                            .CountAsync(x => x.Game == game && x.PuzzleDate == date && x.Status == "solved" && x.ElapsedMs < ms, ct);
                    }

                    games.Add(new DailyGameStatusDto(game, available, a?.Status ?? "new", a?.ElapsedMs, null, rank));
                }
            }

            return Results.Ok(new DailyHubDto(date.ToString("yyyy-MM-dd"), IstClock.NextRollover(now).ToUniversalTime(), games));
        }).RequireAuthorization();

        app.MapGet("/leaderboards/{game}", async (
            string game,
            string? kind,
            string? period,
            Guid? circle,
            ClaimsPrincipal principal,
            AppDbContext db,
            BoardCache cache,
            TimeProvider clock,
            CancellationToken ct) =>
        {
            kind ??= "daily";
            period ??= kind == "daily" ? "today" : "week";
            if (!AllGames.Contains(game)) return Results.NotFound();
            if (kind is not ("daily" or "practice")) return Results.BadRequest(new { error = "kind must be daily or practice." });
            var validPeriod = kind == "daily" ? period is "today" or "week" or "all" : period is "week" or "all";
            if (!validPeriod) return Results.BadRequest(new { error = "Invalid period for this board." });

            var now = clock.GetUtcNow();
            var today = IstClock.Today(now);
            var weekStart = today.AddDays(-(((int)today.DayOfWeek + 6) % 7)); // Monday, India Standard Time
            var weekStartUtc = new DateTimeOffset(weekStart.ToDateTime(TimeOnly.MinValue), IstClock.Offset).ToUniversalTime();
            var me = principal.Identity?.IsAuthenticated == true ? UserIds.Get(principal) : "";

            if (circle is not null)
            {
                // Circle boards are private to members.
                var member = await db.Database.SqlQueryRaw<int>(
                    "SELECT 1 AS \"Value\" FROM circle_members WHERE circle_id = @c AND user_id = @u",
                    new NpgsqlParameter("c", circle.Value), new NpgsqlParameter("u", me)).AnyAsync(ct);
                if (!member) return Results.NotFound();
            }

            var (sql, parameters) = kind == "practice"
                ? PracticeSql(game, period, weekStartUtc, circle)
                : DailySql(game, period, today, weekStart, circle);

            // The ranked board (cached for a few seconds and shared by everyone who asks), plus this player's own row.
            var cacheKey = $"lb|{game}|{kind}|{period}|{circle}|{today:yyyyMMdd}";
            var rows = await RowsAsync(db, cache, cacheKey, $"WITH ranked AS ({sql})", parameters, me, ct);

            var entries = rows.Where(r => r.Rank <= PageSize)
                .Select(r => new LeaderEntryDto(r.Rank, r.Name, r.Value, r.Secondary, r.UserId == me)).ToList();
            var mine = rows.FirstOrDefault(r => r.UserId == me);
            var meDto = mine is null ? null : new LeaderEntryDto(mine.Rank, mine.Name, mine.Value, mine.Secondary, true);

            return Results.Ok(new LeaderboardDto(game, kind, period, kind == "daily" && period == "today" ? today.ToString("yyyy-MM-dd") : null, entries, meDto));
        });

        // The daily mind-training set, ranked by points (out of 600 a day). The points are reported by the app, so this board is for fun:
        // each day is capped at 600 and only a finished set counts.
        app.MapGet("/leaderboards/mind-daily", async (string? period, ClaimsPrincipal principal, AppDbContext db, BoardCache cache, TimeProvider clock, CancellationToken ct) =>
        {
            period ??= "today";
            if (period is not ("today" or "week")) return Results.BadRequest(new { error = "Invalid period for this board." });
            var today = IstClock.Today(clock.GetUtcNow());
            var weekStart = today.AddDays(-(((int)today.DayOfWeek + 6) % 7));
            var start = period == "today" ? today : weekStart;
            var me = UserIds.Get(principal);
            var sql = $"""
                WITH days AS (
                    SELECT e.user_id, e.payload->>'date' AS day,
                           MAX(LEAST(600, GREATEST(0, COALESCE((e.payload->>'points')::int, 0)))) AS pts
                    FROM sync_events e
                    WHERE e.kind = 'mind.daily.completed' AND e.payload->>'date' BETWEEN @start AND @finish
                    GROUP BY e.user_id, e.payload->>'date'
                ), ranked AS (
                    SELECT d.user_id AS "UserId", {NameSql} AS "Name", SUM(d.pts)::bigint AS "Value", COUNT(*)::bigint AS "Secondary",
                           ROW_NUMBER() OVER (ORDER BY SUM(d.pts) DESC, COUNT(*) DESC, d.user_id) AS "Rank"
                    FROM days d JOIN "AspNetUsers" u ON u."Id" = d.user_id
                    GROUP BY d.user_id, u."Id", u."DisplayName", u."HideName"
                )
                """;
            var rows = await RowsAsync(db, cache, $"mind|{period}|{today:yyyyMMdd}", sql,
                [new NpgsqlParameter("start", start.ToString("yyyy-MM-dd")), new NpgsqlParameter("finish", today.ToString("yyyy-MM-dd"))], me, ct);
            var entries = rows.Where(r => r.Rank <= PageSize).Select(r => new LeaderEntryDto(r.Rank, r.Name, r.Value, r.Secondary, r.UserId == me)).ToList();
            var mine = rows.FirstOrDefault(r => r.UserId == me);
            var meDto = mine is null ? null : new LeaderEntryDto(mine.Rank, mine.Name, mine.Value, mine.Secondary, true);
            return Results.Ok(new LeaderboardDto("mind", "daily", period, period == "today" ? today.ToString("yyyy-MM-dd") : null, entries, meDto));
        }).RequireAuthorization();

        // An extra daily (Pinpoint, Chain Link, Crossclimb, Wend, Comet Slice): the day's board ranks the best result of the day by points, then the faster time;
        // the week adds up each day's best. Like the mind board, the numbers are reported by the app, so this is for fun (points capped at 100).
        app.MapGet("/leaderboards/word-daily", async (string? game, string? period, ClaimsPrincipal principal, AppDbContext db, BoardCache cache, TimeProvider clock, CancellationToken ct) =>
        {
            period ??= "today";
            if (game is not ("pinpoint" or "chain-link" or "crossclimb" or "wend" or "comet-slice")) return Results.BadRequest(new { error = "Unknown word daily." });
            if (period is not ("today" or "week")) return Results.BadRequest(new { error = "Invalid period for this board." });
            var today = IstClock.Today(clock.GetUtcNow());
            var weekStart = today.AddDays(-(((int)today.DayOfWeek + 6) % 7));
            var start = period == "today" ? today : weekStart;
            var me = UserIds.Get(principal);
            var sql = $"""
                WITH days AS (
                    SELECT DISTINCT ON (e.user_id, e.payload->>'date') e.user_id, e.payload->>'date' AS day,
                           LEAST(100, GREATEST(0, COALESCE((e.payload->>'points')::int, 0))) AS pts,
                           GREATEST(0, COALESCE((e.payload->>'ms')::bigint, 0)) AS ms
                    FROM sync_events e
                    WHERE e.kind = 'wdaily.completed' AND e.payload->>'game' = @game AND e.payload->>'date' BETWEEN @start AND @finish
                    ORDER BY e.user_id, e.payload->>'date',
                             LEAST(100, GREATEST(0, COALESCE((e.payload->>'points')::int, 0))) DESC,
                             GREATEST(0, COALESCE((e.payload->>'ms')::bigint, 0))
                ), ranked AS (
                    SELECT d.user_id AS "UserId", {NameSql} AS "Name", SUM(d.pts)::bigint AS "Value",
                           {(period == "today" ? "MIN(d.ms)::bigint" : "COUNT(*)::bigint")} AS "Secondary",
                           ROW_NUMBER() OVER (ORDER BY SUM(d.pts) DESC, {(period == "today" ? "MIN(d.ms)" : "COUNT(*) DESC")}, d.user_id) AS "Rank"
                    FROM days d JOIN "AspNetUsers" u ON u."Id" = d.user_id
                    GROUP BY d.user_id, u."Id", u."DisplayName", u."HideName"
                )
                """;
            var rows = await RowsAsync(db, cache, $"wdaily|{game}|{period}|{today:yyyyMMdd}", sql,
                [new NpgsqlParameter("game", game), new NpgsqlParameter("start", start.ToString("yyyy-MM-dd")), new NpgsqlParameter("finish", today.ToString("yyyy-MM-dd"))], me, ct);
            var entries = rows.Where(r => r.Rank <= PageSize).Select(r => new LeaderEntryDto(r.Rank, r.Name, r.Value, r.Secondary, r.UserId == me)).ToList();
            var mine = rows.FirstOrDefault(r => r.UserId == me);
            var meDto = mine is null ? null : new LeaderEntryDto(mine.Rank, mine.Name, mine.Value, mine.Secondary, true);
            return Results.Ok(new LeaderboardDto(game, "daily", period, period == "today" ? today.ToString("yyyy-MM-dd") : null, entries, meDto));
        }).RequireAuthorization();

        // Practice in a mind game: each player's best mark (0 to 100) over all time, then the more plays. Like the other mind boards the marks are reported
        // by the app, so this is for fun.
        app.MapGet("/leaderboards/mind-practice", async (string? game, ClaimsPrincipal principal, AppDbContext db, BoardCache cache, CancellationToken ct) =>
        {
            if (game is null || game.Length is < 1 or > 32 || !game.All(c => char.IsAsciiLetterLower(c) || char.IsAsciiDigit(c) || c == '-')) return Results.BadRequest(new { error = "Unknown mind game." });
            var me = UserIds.Get(principal);
            var sql = $"""
                WITH ranked AS (
                    SELECT s.user_id AS "UserId", {NameSql} AS "Name", s.pct::bigint AS "Value", s.plays::bigint AS "Secondary",
                           ROW_NUMBER() OVER (ORDER BY s.pct DESC, s.plays DESC, s.user_id) AS "Rank"
                    FROM mind_scores s JOIN "AspNetUsers" u ON u."Id" = s.user_id
                    WHERE s.game = @game
                )
                """;
            var rows = await RowsAsync(db, cache, $"mindp|{game}", sql, [new NpgsqlParameter("game", game)], me, ct);
            var entries = rows.Where(r => r.Rank <= PageSize).Select(r => new LeaderEntryDto(r.Rank, r.Name, r.Value, r.Secondary, r.UserId == me)).ToList();
            var mine = rows.FirstOrDefault(r => r.UserId == me);
            var meDto = mine is null ? null : new LeaderEntryDto(mine.Rank, mine.Name, mine.Value, mine.Secondary, true);
            return Results.Ok(new LeaderboardDto(game, "practice", "all", null, entries, meDto));
        }).RequireAuthorization();

        // The featured level of a week (`week` is its Monday). Fewest mistakes wins, then the fastest time; a solve that used hints is not ranked.
        // The mistakes are reported by the app, so like the mind board this one is for fun.
        app.MapGet("/leaderboards/featured", async (string? week, ClaimsPrincipal principal, AppDbContext db, BoardCache cache, CancellationToken ct) =>
        {
            if (week is null || !DateOnly.TryParseExact(week, "yyyy-MM-dd", out _)) return Results.BadRequest(new { error = "week must be a date like 2026-10-12." });
            var me = UserIds.Get(principal);
            var sql = $"""
                WITH best AS (
                    SELECT DISTINCT ON (e.user_id) e.user_id,
                           COALESCE((e.payload->>'mistakes')::int, 0) AS mistakes,
                           COALESCE((e.payload->>'elapsedMs')::bigint, 0) AS ms
                    FROM sync_events e
                    WHERE e.kind = 'puzzle.practice.solved' AND e.payload->>'featured' = @week
                      AND COALESCE((e.payload->>'hinted')::boolean, false) = false
                    ORDER BY e.user_id, COALESCE((e.payload->>'mistakes')::int, 0), COALESCE((e.payload->>'elapsedMs')::bigint, 0)
                ), ranked AS (
                    SELECT b.user_id AS "UserId", {NameSql} AS "Name", b.mistakes::bigint AS "Value", b.ms AS "Secondary",
                           ROW_NUMBER() OVER (ORDER BY b.mistakes, b.ms, b.user_id) AS "Rank"
                    FROM best b JOIN "AspNetUsers" u ON u."Id" = b.user_id
                )
                """;
            var rows = await RowsAsync(db, cache, $"featured|{week}", sql, [new NpgsqlParameter("week", week)], me, ct);
            var entries = rows.Where(r => r.Rank <= PageSize).Select(r => new LeaderEntryDto(r.Rank, r.Name, r.Value, r.Secondary, r.UserId == me)).ToList();
            var mine = rows.FirstOrDefault(r => r.UserId == me);
            var meDto = mine is null ? null : new LeaderEntryDto(mine.Rank, mine.Name, mine.Value, mine.Secondary, true);
            return Results.Ok(new LeaderboardDto("featured", "practice", "week", week, entries, meDto));
        }).RequireAuthorization();
    }

    /// <summary>How many ranked rows a cached board keeps. Anyone ranked deeper than this gets their own row looked up on demand.</summary>
    private const int CacheDepth = 1000;

    /// <summary>
    /// The top of a ranked board, shared through <see cref="BoardCache"/>, and this player's row added when they are ranked below it.
    /// `withClause` is a complete WITH ... ranked AS (...) that exposes UserId, Name, Value, Secondary and Rank.
    /// </summary>
    private static async Task<List<LeaderRow>> RowsAsync(
        AppDbContext db, BoardCache cache, string key, string withClause, NpgsqlParameter[] parameters, string me, CancellationToken ct)
    {
        // Parameters belong to one command, so every query gets its own copies.
        NpgsqlParameter[] Copy() => parameters.Select(p => p.Clone()).ToArray();

        var top = await cache.GetAsync(key, () => db.Database
            .SqlQueryRaw<LeaderRow>($"""{withClause} SELECT * FROM ranked WHERE "Rank" <= {CacheDepth} ORDER BY "Rank" """, Copy())
            .ToListAsync(CancellationToken.None));

        if (top.Count < CacheDepth || top.Any(r => r.UserId == me)) return top;

        var mine = await db.Database
            .SqlQueryRaw<LeaderRow>($"""{withClause} SELECT * FROM ranked WHERE "UserId" = @me""", [.. Copy(), new NpgsqlParameter("me", me)])
            .ToListAsync(ct);
        return [.. top, .. mine];
    }

    private static (string sql, NpgsqlParameter[] parameters) DailySql(string game, string period, DateOnly today, DateOnly weekStart, Guid? circle)
    {
        var start = period == "today" ? today : period == "week" ? weekStart : new DateOnly(2000, 1, 1);
        var end = period == "today" ? today : new DateOnly(2999, 12, 31);
        NpgsqlParameter[] parameters =
        [
            new("game", game),
            new("start", start),
            new("finish", end),
        ];
        if (circle is not null) parameters = [.. parameters, new NpgsqlParameter("circle", circle.Value)];
        var scope = circle is null ? "" : " AND a.user_id IN (SELECT user_id FROM circle_members WHERE circle_id = @circle)";

        // Every finished daily as (user, day, time in ms, guesses).
        var results = game == "word-guess"
            ? $"""
              SELECT a.user_id, a.puzzle_date,
                     GREATEST(0, (EXTRACT(EPOCH FROM (a.finished_at - COALESCE(a.first_guess_at, a.started_at))) * 1000)::bigint) AS ms,
                     cardinality(a.guesses)::bigint AS guesses, a.finished_at
              FROM daily_attempts a
              WHERE a.game = @game AND a.status = 'won' AND a.puzzle_date BETWEEN @start AND @finish{scope}
              """
            : $"""
              SELECT a.user_id, a.puzzle_date, a.elapsed_ms::bigint AS ms, 0::bigint AS guesses, a.finished_at
              FROM puzzle_attempts a
              WHERE a.game = @game AND a.status = 'solved' AND a.puzzle_date BETWEEN @start AND @finish{scope}
              """;

        if (period == "today")
        {
            var order = game == "word-guess" ? "r.guesses, r.ms, r.finished_at" : "r.ms, r.finished_at";
            var value = game == "word-guess" ? "r.guesses" : "r.ms";
            var secondary = game == "word-guess" ? "r.ms" : "0::bigint";
            return ($"""
                SELECT r.user_id AS "UserId", {NameSql} AS "Name", {value} AS "Value", {secondary} AS "Secondary",
                       ROW_NUMBER() OVER (ORDER BY {order}) AS "Rank"
                FROM ({results}) r JOIN "AspNetUsers" u ON u."Id" = r.user_id
                """, parameters);
        }

        return ($"""
            SELECT r.user_id AS "UserId", {NameSql} AS "Name", COUNT(*)::bigint AS "Value", SUM(r.ms)::bigint AS "Secondary",
                   ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, SUM(r.ms), MIN(r.finished_at)) AS "Rank"
            FROM ({results}) r JOIN "AspNetUsers" u ON u."Id" = r.user_id
            GROUP BY r.user_id, u."Id", u."DisplayName"
            """, parameters);
    }

    private static (string sql, NpgsqlParameter[] parameters) PracticeSql(string game, string period, DateTimeOffset weekStartUtc, Guid? circle)
    {
        NpgsqlParameter[] parameters =
        [
            new("game", game),
            new("since", period == "week" ? weekStartUtc : DateTimeOffset.UnixEpoch),
        ];
        if (circle is not null) parameters = [.. parameters, new NpgsqlParameter("circle", circle.Value)];
        var scope = circle is null ? "" : " AND p.user_id IN (SELECT user_id FROM circle_members WHERE circle_id = @circle)";
        return ($"""
            SELECT p.user_id AS "UserId", {NameSql} AS "Name", COUNT(*)::bigint AS "Value", 0::bigint AS "Secondary",
                   ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, MAX(p.solved_at)) AS "Rank"
            FROM practice_solves p JOIN "AspNetUsers" u ON u."Id" = p.user_id
            WHERE p.game = @game AND p.solved_at >= @since{scope}
            GROUP BY p.user_id, u."Id", u."DisplayName"
            """, parameters);
    }
}
