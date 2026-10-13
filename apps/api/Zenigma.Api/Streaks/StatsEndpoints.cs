using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Zenigma.Api.Auth;
using Zenigma.Api.Data;
using Zenigma.Api.Games.Puzzles;
using Zenigma.Api.Infrastructure;

namespace Zenigma.Api.Streaks;

public record GameStatsDto(
    string Game,
    int Solved,
    int Current,
    int Best,
    long? BestMs,
    long? AverageMs,
    double? AverageGuesses,
    int? BestGuesses,
    List<string> Recent,
    List<string> Frozen,
    int Freezes,
    int NextFreezeIn);

/// <summary>Freezes held in total, the most one game can hold, and how many days of play earn one.</summary>
public record RewardsDto(int Freezes, int MaxFreezes, int DaysPerFreeze);

public record StatsDto(string Date, RewardsDto Rewards, List<GameStatsDto> Games);

public static class StatsEndpoints
{
    private const int RecentDays = 35;
    private static readonly string[] AllGames = ["word-guess", .. PuzzleRules.Games];

    public static void MapStats(this IEndpointRouteBuilder app)
    {
        app.MapGet("/stats", async (ClaimsPrincipal principal, AppDbContext db, TimeProvider clock, CancellationToken ct) =>
        {
            var userId = UserIds.Get(principal);
            var today = IstClock.Today(clock.GetUtcNow());
            var since = today.AddDays(-(RecentDays - 1));

            // Three queries for every game together, instead of two per game: the database is a network hop away.
            var freezes = (await db.StreakFreezes.AsNoTracking().Where(f => f.UserId == userId).Select(f => new { f.Game, f.CoveredDate }).ToListAsync(ct))
                .ToLookup(f => f.Game, f => f.CoveredDate);
            var wonWords = await db.DailyAttempts.AsNoTracking().Where(a => a.UserId == userId && a.Game == "word-guess" && a.Status == "won").ToListAsync(ct);
            var solvedPuzzles = (await db.PuzzleAttempts.AsNoTracking().Where(a => a.UserId == userId && a.Status == "solved").ToListAsync(ct))
                .ToLookup(a => a.Game);

            var freezeRows = (await db.GameFreezes.Where(r => r.UserId == userId).ToListAsync(ct)).ToDictionary(r => r.Game);
            var games = new List<GameStatsDto>();
            foreach (var game in AllGames)
            {
                var frozenDates = freezes[game].ToList();
                List<DateOnly> solvedDates;
                long? bestMs = null;
                long? avgMs = null;
                double? avgGuesses = null;
                int? bestGuesses = null;

                if (game == "word-guess")
                {
                    var won = wonWords;
                    solvedDates = won.Select(a => a.PuzzleDate).ToList();
                    if (won.Count > 0)
                    {
                        avgGuesses = Math.Round(won.Average(a => a.Guesses.Count), 1);
                        bestGuesses = won.Min(a => a.Guesses.Count);
                    }
                }
                else
                {
                    var solved = solvedPuzzles[game].ToList();
                    solvedDates = solved.Select(a => a.PuzzleDate).ToList();
                    var times = solved.Where(a => a.ElapsedMs != null).Select(a => (long)a.ElapsedMs!.Value).ToList();
                    if (times.Count > 0)
                    {
                        bestMs = times.Min();
                        avgMs = (long)times.Average();
                    }
                }

                var played = solvedDates.Distinct().Count();
                if (!freezeRows.TryGetValue(game, out var freezeRow))
                {
                    freezeRow = new GameFreeze { UserId = userId, Game = game };
                    freezeRows[game] = freezeRow;
                    db.GameFreezes.Add(freezeRow);
                }

                StreakService.Credit(freezeRow, played);
                var (current, best) = StreakMath.Compute(solvedDates.Concat(frozenDates), today);
                games.Add(new GameStatsDto(
                    game,
                    solvedDates.Count,
                    current,
                    best,
                    bestMs,
                    avgMs,
                    avgGuesses,
                    bestGuesses,
                    solvedDates.Where(d => d >= since).OrderBy(d => d).Select(d => d.ToString("yyyy-MM-dd")).ToList(),
                    frozenDates.Where(d => d >= since).OrderBy(d => d).Select(d => d.ToString("yyyy-MM-dd")).ToList(),
                    freezeRow.Freezes,
                    StreakService.DaysToNext(played)));
            }

            await db.SaveChangesAsync(ct);
            return Results.Ok(new StatsDto(
                today.ToString("yyyy-MM-dd"),
                new RewardsDto(games.Sum(g => g.Freezes), StreakService.MaxFreezes, StreakService.DaysPerFreeze),
                games));
        }).RequireAuthorization();
    }
}
