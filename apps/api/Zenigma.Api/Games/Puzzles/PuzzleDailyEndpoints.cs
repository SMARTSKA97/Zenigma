using System.Security.Claims;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using NpgsqlTypes;
using Zenigma.Api.Auth;
using Zenigma.Api.Data;
using Zenigma.Api.Infrastructure;
using Zenigma.Api.Sync;

namespace Zenigma.Api.Games.Puzzles;

public record PuzzleStartRequest(Guid? DeviceId, string? Platform);
public record PuzzleSubmitRequest(Guid? DeviceId, JsonElement Solution, int? Hints = null);

public record PuzzleAttemptDto(
    string Status,
    DateTimeOffset StartedAt,
    DateTimeOffset? FinishedAt,
    int? ElapsedMs,
    int? Rank,
    bool ActiveOnThisDevice,
    JsonElement? Puzzle,
    int? Finishers = null,
    int Hints = 0);

public record PuzzleDailyStateDto(string Date, DateTimeOffset NextRolloverUtc, PuzzleAttemptDto? Attempt);

/// <summary>
/// The daily Queens, Tango, Sudoku, Zip and Patches. The puzzle is revealed only when the player starts, which also starts the
/// server's clock. A solution is checked by the rules and timed by the server, so a modified app cannot report a fake time.
/// One attempt per player per day, on one device at a time (an idle device's lease can be taken over, resuming the same puzzle).
/// </summary>
public static class PuzzleDailyEndpoints
{
    public const string EventKind = "puzzle.daily";

    /// <summary>Hints are only recorded for now (sent with the result, so using one never needs a connection). They do not change the ranking.</summary>
    public const int MaxHints = 99;

    public static void MapPuzzleDaily(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/daily/{game}").RequireAuthorization();

        group.MapGet("", async (string game, Guid? deviceId, ClaimsPrincipal principal, AppDbContext db, TimeProvider clock, CancellationToken ct) =>
        {
            if (!PuzzleRules.IsPuzzleGame(game)) return Results.NotFound();
            var now = clock.GetUtcNow();
            var date = IstClock.Today(now);
            var userId = UserIds.Get(principal);

            var puzzle = await FindPuzzleAsync(db, game, date, ct);
            if (puzzle is null) return NoPuzzle();

            var attempt = await db.PuzzleAttempts.AsNoTracking()
                .FirstOrDefaultAsync(a => a.UserId == userId && a.Game == game && a.PuzzleDate == date, ct);
            return Results.Ok(await StateAsync(db, game, date, now, attempt, puzzle, deviceId, ct));
        });

        group.MapPost("/start", async (
            string game,
            PuzzleStartRequest request,
            ClaimsPrincipal principal,
            AppDbContext db,
            TimeProvider clock,
            IConfiguration config,
            CancellationToken ct) =>
        {
            if (!PuzzleRules.IsPuzzleGame(game)) return Results.NotFound();
            if (request.DeviceId is null || request.DeviceId == Guid.Empty)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["deviceId"] = ["deviceId is required."] });

            var deviceId = request.DeviceId.Value;
            var now = clock.GetUtcNow();
            var date = IstClock.Today(now);
            var userId = UserIds.Get(principal);
            var lease = TimeSpan.FromSeconds(config.GetValue("Daily:LeaseSeconds", 120));

            var puzzle = await FindPuzzleAsync(db, game, date, ct);
            if (puzzle is null) return NoPuzzle();

            var platform = request.Platform is { Length: > 0 and <= 16 } p ? p : "web";
            if (!await DeviceRegistry.RegisterAsync(db, userId, deviceId, platform, ct)) return Results.Forbid();

            await using var tx = await db.Database.BeginTransactionAsync(ct);
            var attempt = await LockAttemptAsync(db, userId, game, date, ct);

            if (attempt is null)
            {
                attempt = new PuzzleAttempt
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    Game = game,
                    PuzzleDate = date,
                    DeviceId = deviceId,
                    StartedAt = now,
                    LastActiveAt = now,
                };
                db.PuzzleAttempts.Add(attempt);
            }
            else if (attempt.Status != "playing")
            {
                return Refused("already-played", await StateAsync(db, game, date, now, attempt, puzzle, deviceId, ct));
            }
            else if (attempt.DeviceId == deviceId || now - attempt.LastActiveAt > lease)
            {
                attempt.DeviceId = deviceId;
                attempt.LastActiveAt = now;
            }
            else
            {
                return Refused("active-elsewhere", await StateAsync(db, game, date, now, attempt, puzzle, deviceId, ct));
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

            return Results.Ok(await StateAsync(db, game, date, now, attempt, puzzle, deviceId, ct));
        });

        // Keeps the lease alive while the person is playing, so another device cannot take the attempt over mid-game.
        group.MapPost("/heartbeat", async (string game, PuzzleStartRequest request, ClaimsPrincipal principal, AppDbContext db, TimeProvider clock, CancellationToken ct) =>
        {
            if (!PuzzleRules.IsPuzzleGame(game) || request.DeviceId is null) return Results.NotFound();
            var now = clock.GetUtcNow();
            var date = IstClock.Today(now);
            var userId = UserIds.Get(principal);
            var touched = await db.PuzzleAttempts
                .Where(a => a.UserId == userId && a.Game == game && a.PuzzleDate == date && a.Status == "playing" && a.DeviceId == request.DeviceId)
                .ExecuteUpdateAsync(s => s.SetProperty(a => a.LastActiveAt, now), ct);
            return touched == 1 ? Results.NoContent() : Results.Conflict(new { error = "not-active-device" });
        });

        group.MapPost("/submit", async (
            string game,
            PuzzleSubmitRequest request,
            ClaimsPrincipal principal,
            AppDbContext db,
            TimeProvider clock,
            IConfiguration config,
            CancellationToken ct) =>
        {
            if (!PuzzleRules.IsPuzzleGame(game)) return Results.NotFound();
            if (request.DeviceId is null || request.DeviceId == Guid.Empty)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["deviceId"] = ["deviceId is required."] });

            var now = clock.GetUtcNow();
            var date = IstClock.Today(now);
            var userId = UserIds.Get(principal);

            var puzzle = await FindPuzzleAsync(db, game, date, ct);
            if (puzzle is null) return NoPuzzle();

            await using var tx = await db.Database.BeginTransactionAsync(ct);
            var attempt = await LockAttemptAsync(db, userId, game, date, ct);
            if (attempt is null) return Results.Json(new { error = "no-attempt" }, statusCode: StatusCodes.Status404NotFound);
            if (attempt.Status != "playing") return Refused("already-finished", await StateAsync(db, game, date, now, attempt, puzzle, request.DeviceId, ct));
            if (attempt.DeviceId != request.DeviceId) return Refused("not-active-device", await StateAsync(db, game, date, now, attempt, puzzle, request.DeviceId, ct));

            if (!PuzzleRules.Verify(game, puzzle.RootElement, request.Solution))
                return Results.Json(new { error = "incorrect" }, statusCode: StatusCodes.Status422UnprocessableEntity);

            var elapsed = (int)Math.Min((now - attempt.StartedAt).TotalMilliseconds, int.MaxValue);
            if (elapsed < config.GetValue("Puzzle:MinSolveMs", PuzzleRules.MinSolveMs(game, puzzle.RootElement)))
                return Results.Json(new { error = "too-fast" }, statusCode: StatusCodes.Status422UnprocessableEntity);

            attempt.Status = "solved";
            attempt.FinishedAt = now;
            attempt.ElapsedMs = elapsed;
            attempt.Hints = Math.Clamp(request.Hints ?? 0, 0, MaxHints);
            attempt.LastActiveAt = now;
            await db.SaveChangesAsync(ct);
            await RecordResultAsync(db, attempt, now, ct);
            await Streaks.StreakService.OnSolvedAsync(db, attempt.UserId, game, attempt.PuzzleDate, ct);
            await tx.CommitAsync(ct);

            return Results.Ok(await StateAsync(db, game, date, now, attempt, puzzle, request.DeviceId, ct));
        });
    }

    private static async Task<JsonDocument?> FindPuzzleAsync(AppDbContext db, string game, DateOnly date, CancellationToken ct) =>
        (await db.DailyPuzzles.AsNoTracking().FirstOrDefaultAsync(p => p.Game == game && p.PuzzleDate == date, ct))?.Puzzle;

    private static async Task<PuzzleAttempt?> LockAttemptAsync(AppDbContext db, string userId, string game, DateOnly date, CancellationToken ct)
    {
        var rows = await db.PuzzleAttempts
            .FromSqlInterpolated($"SELECT * FROM puzzle_attempts WHERE user_id = {userId} AND game = {game} AND puzzle_date = {date} FOR UPDATE")
            .ToListAsync(ct);
        return rows.FirstOrDefault();
    }

    private static async Task RecordResultAsync(AppDbContext db, PuzzleAttempt attempt, DateTimeOffset now, CancellationToken ct)
    {
        var payload = JsonSerializer.Serialize(new
        {
            game = attempt.Game,
            date = attempt.PuzzleDate.ToString("yyyy-MM-dd"),
            status = attempt.Status,
            elapsedMs = attempt.ElapsedMs,
            hints = attempt.Hints,
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

    private static async Task<PuzzleDailyStateDto> StateAsync(
        AppDbContext db, string game, DateOnly date, DateTimeOffset now, PuzzleAttempt? attempt, JsonDocument puzzle, Guid? deviceId, CancellationToken ct)
    {
        PuzzleAttemptDto? dto = null;
        if (attempt is not null)
        {
            var active = deviceId is not null && attempt.DeviceId == deviceId;
            int? rank = null;
            int? finishers = null;
            if (attempt is { Status: "solved", ElapsedMs: { } ms })
            {
                rank = 1 + await db.PuzzleAttempts.AsNoTracking()
                    .CountAsync(a => a.Game == game && a.PuzzleDate == date && a.Status == "solved" && a.ElapsedMs < ms, ct);
                finishers = await db.PuzzleAttempts.AsNoTracking()
                    .CountAsync(a => a.Game == game && a.PuzzleDate == date && a.Status == "solved", ct);
            }

            // The puzzle itself goes only to the device that is playing it.
            dto = new PuzzleAttemptDto(
                attempt.Status,
                attempt.StartedAt,
                attempt.FinishedAt,
                attempt.ElapsedMs,
                rank,
                active,
                attempt.Status == "playing" && active ? puzzle.RootElement.Clone() : null,
                finishers,
                attempt.Hints);
        }

        return new PuzzleDailyStateDto(date.ToString("yyyy-MM-dd"), IstClock.NextRollover(now).ToUniversalTime(), dto);
    }

    private static IResult NoPuzzle() =>
        Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "No puzzle is scheduled for today.");

    private static IResult Refused(string error, PuzzleDailyStateDto state) =>
        Results.Json(new { error, state }, statusCode: StatusCodes.Status409Conflict);
}
