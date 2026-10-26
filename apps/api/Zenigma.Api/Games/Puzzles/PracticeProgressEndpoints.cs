using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Zenigma.Api.Auth;
using Zenigma.Api.Data;

namespace Zenigma.Api.Games.Puzzles;

public record PracticeSolveRow(string Game, string LevelKey, int? ElapsedMs);

public record PracticeSolveDto(string Game, string? Variant, int Level, int? ElapsedMs);

/// <summary>
/// The server's copy of every verified practice level the player has solved, so a fresh install (a PWA, a new phone)
/// can rebuild its progress without replaying the whole event log.
/// </summary>
public static class PracticeProgressEndpoints
{
    public static void MapPracticeProgress(this IEndpointRouteBuilder app)
    {
        app.MapGet("/practice/progress", async (ClaimsPrincipal principal, AppDbContext db, CancellationToken ct) =>
        {
            var userId = UserIds.Get(principal);
            var rows = await db.Database.SqlQueryRaw<PracticeSolveRow>(
                """
                SELECT game AS "Game", level_key AS "LevelKey", elapsed_ms AS "ElapsedMs"
                FROM practice_solves WHERE user_id = {0}
                """, userId).ToListAsync(ct);

            var solves = new List<PracticeSolveDto>(rows.Count);
            foreach (var row in rows)
            {
                // Level keys are "<level>" or "<variant>:<level>"; word-guess keys are words and are skipped.
                var key = row.LevelKey;
                var colon = key.LastIndexOf(':');
                var variant = colon >= 0 ? key[..colon] : null;
                if (!int.TryParse(colon >= 0 ? key[(colon + 1)..] : key, out var level) || level < 1) continue;
                solves.Add(new PracticeSolveDto(row.Game, variant, level, row.ElapsedMs));
            }
            return Results.Ok(new { solves });
        }).RequireAuthorization();
    }
}
