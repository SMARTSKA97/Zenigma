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

    private const string NameSql = """COALESCE(NULLIF(u."DisplayName", ''), 'Player ' || upper(substr(md5(u."Id"), 1, 4)))""";

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
            ClaimsPrincipal principal,
            AppDbContext db,
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

            var (sql, parameters) = kind == "practice"
                ? PracticeSql(game, period, weekStartUtc)
                : DailySql(game, period, today, weekStart);

            // The ranked board, trimmed to the top of the table plus this player's own row.
            var full = $"""WITH ranked AS ({sql}) SELECT * FROM ranked WHERE "Rank" <= {PageSize} OR "UserId" = @me ORDER BY "Rank" """;
            var rows = await db.Database.SqlQueryRaw<LeaderRow>(full, [.. parameters, new NpgsqlParameter("me", me)]).ToListAsync(ct);

            var entries = rows.Where(r => r.Rank <= PageSize)
                .Select(r => new LeaderEntryDto(r.Rank, r.Name, r.Value, r.Secondary, r.UserId == me)).ToList();
            var mine = rows.FirstOrDefault(r => r.UserId == me);
            var meDto = mine is null ? null : new LeaderEntryDto(mine.Rank, mine.Name, mine.Value, mine.Secondary, true);

            return Results.Ok(new LeaderboardDto(game, kind, period, kind == "daily" && period == "today" ? today.ToString("yyyy-MM-dd") : null, entries, meDto));
        });
    }

    private static (string sql, NpgsqlParameter[] parameters) DailySql(string game, string period, DateOnly today, DateOnly weekStart)
    {
        var start = period == "today" ? today : period == "week" ? weekStart : new DateOnly(2000, 1, 1);
        var end = period == "today" ? today : new DateOnly(2999, 12, 31);
        NpgsqlParameter[] parameters =
        [
            new("game", game),
            new("start", start),
            new("finish", end),
        ];

        // Every finished daily as (user, day, time in ms, guesses).
        var results = game == "word-guess"
            ? """
              SELECT a.user_id, a.puzzle_date,
                     GREATEST(0, (EXTRACT(EPOCH FROM (a.finished_at - COALESCE(a.first_guess_at, a.started_at))) * 1000)::bigint) AS ms,
                     cardinality(a.guesses)::bigint AS guesses, a.finished_at
              FROM daily_attempts a
              WHERE a.game = @game AND a.status = 'won' AND a.puzzle_date BETWEEN @start AND @finish
              """
            : """
              SELECT a.user_id, a.puzzle_date, a.elapsed_ms::bigint AS ms, 0::bigint AS guesses, a.finished_at
              FROM puzzle_attempts a
              WHERE a.game = @game AND a.status = 'solved' AND a.puzzle_date BETWEEN @start AND @finish
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

    private static (string sql, NpgsqlParameter[] parameters) PracticeSql(string game, string period, DateTimeOffset weekStartUtc)
    {
        NpgsqlParameter[] parameters =
        [
            new("game", game),
            new("since", period == "week" ? weekStartUtc : DateTimeOffset.UnixEpoch),
        ];
        return ($"""
            SELECT p.user_id AS "UserId", {NameSql} AS "Name", COUNT(*)::bigint AS "Value", 0::bigint AS "Secondary",
                   ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, MAX(p.solved_at)) AS "Rank"
            FROM practice_solves p JOIN "AspNetUsers" u ON u."Id" = p.user_id
            WHERE p.game = @game AND p.solved_at >= @since
            GROUP BY p.user_id, u."Id", u."DisplayName"
            """, parameters);
    }
}
