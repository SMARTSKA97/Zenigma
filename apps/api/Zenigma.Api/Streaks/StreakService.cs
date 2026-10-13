using Microsoft.EntityFrameworkCore;
using Zenigma.Api.Data;

namespace Zenigma.Api.Streaks;

/// <summary>
/// Streak freezes. Every game has its own: play a game on 7 different days to earn one freeze for it, hold up to two,
/// and a freeze covers one missed day for that game automatically so its streak carries on.
/// </summary>
public static class StreakService
{
    public const int MaxFreezes = 2;
    public const int DaysPerFreeze = 7;

    /// <summary>The days a game was solved: puzzle attempts that are solved, or Word Guess attempts that were won.</summary>
    public static async Task<List<DateOnly>> SolvedDatesAsync(AppDbContext db, string userId, string game, CancellationToken ct) =>
        game == "word-guess"
            ? await db.DailyAttempts.AsNoTracking().Where(a => a.UserId == userId && a.Game == game && a.Status == "won").Select(a => a.PuzzleDate).ToListAsync(ct)
            : await db.PuzzleAttempts.AsNoTracking().Where(a => a.UserId == userId && a.Game == game && a.Status == "solved").Select(a => a.PuzzleDate).ToListAsync(ct);

    /// <summary>Pays out the freezes earned by `playedDays` days of play (each set of seven earns one, up to the limit).</summary>
    public static void Credit(GameFreeze row, int playedDays)
    {
        var blocks = playedDays / DaysPerFreeze;
        if (blocks <= row.CreditedBlocks) return;
        row.Freezes = Math.Min(MaxFreezes, row.Freezes + blocks - row.CreditedBlocks);
        row.CreditedBlocks = blocks;
    }

    /// <summary>Days of play still needed for the next freeze.</summary>
    public static int DaysToNext(int playedDays) => DaysPerFreeze - playedDays % DaysPerFreeze;

    /// <summary>
    /// Called inside the transaction that records a finished daily. If exactly one day was missed since the last result and
    /// the player holds a freeze for this game, the freeze covers that day so the streak carries on.
    /// </summary>
    public static async Task OnSolvedAsync(AppDbContext db, string userId, string game, DateOnly date, CancellationToken ct)
    {
        var yesterday = date.AddDays(-1);
        var dayBefore = date.AddDays(-2);
        var solved = await SolvedDatesAsync(db, userId, game, ct);
        var frozen = await db.StreakFreezes.AsNoTracking().Where(f => f.UserId == userId && f.Game == game).Select(f => f.CoveredDate).ToListAsync(ct);

        var row = await db.GameFreezes.FirstOrDefaultAsync(r => r.UserId == userId && r.Game == game, ct);
        if (row is null)
        {
            row = new GameFreeze { UserId = userId, Game = game };
            db.GameFreezes.Add(row);
        }

        Credit(row, solved.Distinct().Count());

        var covered = solved.Concat(frozen).ToHashSet();
        if (!covered.Contains(yesterday) && covered.Contains(dayBefore) && row.Freezes > 0)
        {
            row.Freezes--;
            db.StreakFreezes.Add(new StreakFreeze { UserId = userId, Game = game, CoveredDate = yesterday, CreatedAt = DateTimeOffset.UtcNow });
        }

        await db.SaveChangesAsync(ct);
    }
}
