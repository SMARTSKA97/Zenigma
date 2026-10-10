using System.Security.Claims;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using NpgsqlTypes;
using Zenigma.Api.Auth;
using Zenigma.Api.Data;
using Zenigma.Api.Infrastructure;
using Zenigma.Api.Sync;

namespace Zenigma.Api.Games.WordGuess;

public record StartRequest(Guid? DeviceId, bool? Hard, string? Platform);
public record GuessRequest(Guid? DeviceId, string? Word);

public record GuessDto(string Word, string Marks);

public record AttemptDto(
    bool Hard,
    string Status,
    List<GuessDto> Guesses,
    DateTimeOffset StartedAt,
    DateTimeOffset? FirstGuessAt,
    DateTimeOffset? FinishedAt,
    string? Answer,
    bool ActiveOnThisDevice);

public record DailyStateDto(string Date, DateTimeOffset NextRolloverUtc, AttemptDto? Attempt);

public record GuessResponse(GuessDto Guess, string Status, string? Answer, int GuessCount);

/// <summary>
/// The daily Word Guess. Played online only: the server holds the answer, checks every guess itself and times the
/// attempt from the first guess, so a modified app cannot see the answer or fake a result. Each player gets one
/// attempt per day, on one device at a time; an idle device's lease can be taken over by another device, which then
/// resumes the same board.
/// </summary>
public static class DailyEndpoints
{
    public const string Game = "word-guess";
    public const string EventKind = "wordguess.daily";

    public static void MapDaily(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/daily/word-guess").RequireAuthorization();

        group.MapGet("", async (Guid? deviceId, ClaimsPrincipal principal, AppDbContext db, TimeProvider clock, CancellationToken ct) =>
        {
            var now = clock.GetUtcNow();
            var date = IstClock.Today(now);
            var userId = UserIds.Get(principal);

            var puzzle = await db.DailyPuzzles.AsNoTracking().FirstOrDefaultAsync(p => p.Game == Game && p.PuzzleDate == date, ct);
            if (puzzle is null) return NoPuzzle();

            var attempt = await db.DailyAttempts.AsNoTracking()
                .FirstOrDefaultAsync(a => a.UserId == userId && a.Game == Game && a.PuzzleDate == date, ct);
            return Results.Ok(State(date, now, attempt, AnswerOf(puzzle), deviceId));
        });

        group.MapPost("/start", async (
            StartRequest request,
            ClaimsPrincipal principal,
            AppDbContext db,
            TimeProvider clock,
            IConfiguration config,
            CancellationToken ct) =>
        {
            if (request.DeviceId is null || request.DeviceId == Guid.Empty)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["deviceId"] = ["deviceId is required."] });

            var deviceId = request.DeviceId.Value;
            var now = clock.GetUtcNow();
            var date = IstClock.Today(now);
            var userId = UserIds.Get(principal);
            var lease = TimeSpan.FromSeconds(config.GetValue("Daily:LeaseSeconds", 120));

            var puzzle = await db.DailyPuzzles.AsNoTracking().FirstOrDefaultAsync(p => p.Game == Game && p.PuzzleDate == date, ct);
            if (puzzle is null) return NoPuzzle();
            var answer = AnswerOf(puzzle);

            var platform = request.Platform is { Length: > 0 and <= 16 } p ? p : "web";
            if (!await DeviceRegistry.RegisterAsync(db, userId, deviceId, platform, ct)) return Results.Forbid();

            await using var tx = await db.Database.BeginTransactionAsync(ct);
            var attempt = await LockAttemptAsync(db, userId, date, ct);

            if (attempt is null)
            {
                attempt = new DailyAttempt
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    Game = Game,
                    PuzzleDate = date,
                    DeviceId = deviceId,
                    Hard = request.Hard == true,
                    StartedAt = now,
                    LastActiveAt = now,
                };
                db.DailyAttempts.Add(attempt);
            }
            else if (attempt.Status != "playing")
            {
                return Refused("already-played", State(date, now, attempt, answer, deviceId));
            }
            else if (attempt.DeviceId == deviceId || now - attempt.LastActiveAt > lease)
            {
                // Same device resuming, or the other device has been idle past the lease: take over, same board.
                attempt.DeviceId = deviceId;
                attempt.LastActiveAt = now;
            }
            else
            {
                return Refused("active-elsewhere", State(date, now, attempt, answer, deviceId));
            }

            try
            {
                await db.SaveChangesAsync(ct);
                await tx.CommitAsync(ct);
            }
            catch (DbUpdateException)
            {
                return Results.Json(new { error = "retry" }, statusCode: StatusCodes.Status409Conflict);
            }

            return Results.Ok(State(date, now, attempt, answer, deviceId));
        });

        group.MapPost("/guess", async (
            GuessRequest request,
            ClaimsPrincipal principal,
            AppDbContext db,
            WordList words,
            TimeProvider clock,
            CancellationToken ct) =>
        {
            if (request.DeviceId is null || request.DeviceId == Guid.Empty)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["deviceId"] = ["deviceId is required."] });

            var word = (request.Word ?? "").Trim().ToLowerInvariant();
            if (word.Length != WordGuessEngine.WordLength) return Rejected("too-short");
            if (!word.All(c => c is >= 'a' and <= 'z')) return Rejected("not-a-word");

            var now = clock.GetUtcNow();
            var date = IstClock.Today(now);
            var userId = UserIds.Get(principal);

            var puzzle = await db.DailyPuzzles.AsNoTracking().FirstOrDefaultAsync(p => p.Game == Game && p.PuzzleDate == date, ct);
            if (puzzle is null) return NoPuzzle();
            var answer = AnswerOf(puzzle);

            await using var tx = await db.Database.BeginTransactionAsync(ct);
            var attempt = await LockAttemptAsync(db, userId, date, ct);
            if (attempt is null) return Results.Json(new { error = "no-attempt" }, statusCode: StatusCodes.Status404NotFound);
            if (attempt.Status != "playing") return Refused("already-finished", State(date, now, attempt, answer, request.DeviceId));
            if (attempt.DeviceId != request.DeviceId) return Refused("not-active-device", State(date, now, attempt, answer, request.DeviceId));

            if (!words.IsValid(word)) return Rejected("not-a-word");
            if (attempt.Hard)
            {
                var problem = WordGuessEngine.FindHardModeProblem(attempt.Guesses, answer, word);
                if (problem is not null)
                {
                    return Results.Json(new { error = "hard-mode", detail = problem }, statusCode: StatusCodes.Status422UnprocessableEntity);
                }
            }

            var marks = WordGuessEngine.MarksToString(WordGuessEngine.Evaluate(word, answer));
            attempt.Guesses = [.. attempt.Guesses, word];
            attempt.FirstGuessAt ??= now;
            attempt.LastActiveAt = now;

            if (word == answer) attempt.Status = "won";
            else if (attempt.Guesses.Count >= WordGuessEngine.MaxGuesses) attempt.Status = "lost";
            if (attempt.Status != "playing") attempt.FinishedAt = now;

            await db.SaveChangesAsync(ct);
            if (attempt.Status != "playing") await RecordResultAsync(db, attempt, now, ct);
            await tx.CommitAsync(ct);

            return Results.Ok(new GuessResponse(
                new GuessDto(word, marks),
                attempt.Status,
                attempt.Status == "playing" ? null : answer,
                attempt.Guesses.Count));
        });
    }

    private static string AnswerOf(DailyPuzzle puzzle) => puzzle.Puzzle.RootElement.GetProperty("answer").GetString()!;

    private static async Task<DailyAttempt?> LockAttemptAsync(AppDbContext db, string userId, DateOnly date, CancellationToken ct)
    {
        var rows = await db.DailyAttempts
            .FromSqlInterpolated($"SELECT * FROM daily_attempts WHERE user_id = {userId} AND game = {Game} AND puzzle_date = {date} FOR UPDATE")
            .ToListAsync(ct);
        return rows.FirstOrDefault();
    }

    /// <summary>The finished result also goes into the player's sync log, so every device they use shows it.</summary>
    private static async Task RecordResultAsync(AppDbContext db, DailyAttempt attempt, DateTimeOffset now, CancellationToken ct)
    {
        var payload = JsonSerializer.Serialize(new
        {
            date = attempt.PuzzleDate.ToString("yyyy-MM-dd"),
            status = attempt.Status,
            guesses = attempt.Guesses,
            hard = attempt.Hard,
            durationMs = attempt.FirstGuessAt is { } first ? (long)(now - first).TotalMilliseconds : 0L,
        });

        await db.Database.ExecuteSqlRawAsync(
            """
            INSERT INTO sync_events (id, user_id, device_id, kind, payload, client_created_at)
            VALUES (@id, @user, @device, @kind, @payload, @created)
            ON CONFLICT (user_id, id) DO NOTHING
            """,
            [
                new NpgsqlParameter("id", Guid.NewGuid()),
                new NpgsqlParameter("user", attempt.UserId),
                new NpgsqlParameter("device", attempt.DeviceId),
                new NpgsqlParameter("kind", EventKind),
                new NpgsqlParameter("payload", NpgsqlDbType.Jsonb) { Value = payload },
                new NpgsqlParameter("created", now.ToUniversalTime()),
            ],
            ct);
    }

    private static DailyStateDto State(DateOnly date, DateTimeOffset now, DailyAttempt? attempt, string answer, Guid? deviceId)
    {
        AttemptDto? dto = null;
        if (attempt is not null)
        {
            var finished = attempt.Status != "playing";
            dto = new AttemptDto(
                attempt.Hard,
                attempt.Status,
                attempt.Guesses.Select(g => new GuessDto(g, WordGuessEngine.MarksToString(WordGuessEngine.Evaluate(g, answer)))).ToList(),
                attempt.StartedAt,
                attempt.FirstGuessAt,
                attempt.FinishedAt,
                finished ? answer : null,
                deviceId is not null && attempt.DeviceId == deviceId);
        }

        return new DailyStateDto(date.ToString("yyyy-MM-dd"), IstClock.NextRollover(now).ToUniversalTime(), dto);
    }

    private static IResult NoPuzzle() =>
        Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "No puzzle is scheduled for today.");

    private static IResult Rejected(string error) =>
        Results.Json(new { error }, statusCode: StatusCodes.Status422UnprocessableEntity);

    private static IResult Refused(string error, DailyStateDto state) =>
        Results.Json(new { error, state }, statusCode: StatusCodes.Status409Conflict);
}
