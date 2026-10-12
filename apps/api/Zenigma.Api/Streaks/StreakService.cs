using Microsoft.EntityFrameworkCore;
using Zenigma.Api.Data;

namespace Zenigma.Api.Streaks;

/// <summary>Streak freezes and the weekly reward.</summary>
public static class StreakService
{
    public const int MaxFreezes = 2;
    public const int WeeklyGoal = 5;

    /// <summary>The days a game was solved: puzzle attempts that are solved, or Word Guess attempts that were won.</summary>
    public static async Task<List<DateOnly>> SolvedDatesAsync(AppDbContext db, string userId, string game, CancellationToken ct) =>
        game == "word-guess"
            ? await db.DailyAttempts.AsNoTracking().Where(a => a.UserId == userId && a.Game == game && a.Status == "won").Select(a => a.PuzzleDate).ToListAsync(ct)
            : await db.PuzzleAttempts.AsNoTracking().Where(a => a.UserId == userId && a.Game == game && a.Status == "solved").Select(a => a.PuzzleDate).ToListAsync(ct);

    /// <summary>
    /// Called inside the transaction that records a finished daily. If exactly one day was missed since the last result and
    /// the player holds a freeze, the freeze covers that day so the streak carries on.
    /// </summary>
    public static async Task OnSolvedAsync(AppDbContext db, string userId, string game, DateOnly date, CancellationToken ct)
    {
        var yesterday = date.AddDays(-1);
        var dayBefore = date.AddDays(-2);
        var solved = await SolvedDatesAsync(db, userId, game, ct);
        var frozen = await db.StreakFreezes.AsNoTracking().Where(f => f.UserId == userId && f.Game == game).Select(f => f.CoveredDate).ToListAsync(ct);
        var covered = solved.Concat(frozen).ToHashSet();
        if (covered.Contains(yesterday) || !covered.Contains(dayBefore)) return;

        var reward = await db.UserRewards.FirstOrDefaultAsync(r => r.UserId == userId, ct);
        if (reward is null || reward.Freezes <= 0) return;

        reward.Freezes--;
        db.StreakFreezes.Add(new StreakFreeze { UserId = userId, Game = game, CoveredDate = yesterday, CreatedAt = DateTimeOffset.UtcNow });
        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Gives a freeze for last week if the player solved enough dailies in it (and none has been given for that week yet).
    /// Returns the player's reward row.
    /// </summary>
    public static async Task<UserReward> SettleWeekAsync(AppDbContext db, string userId, DateOnly today, CancellationToken ct)
    {
        var reward = await db.UserRewards.FirstOrDefaultAsync(r => r.UserId == userId, ct);
        if (reward is null)
        {
            reward = new UserReward { UserId = userId };
            db.UserRewards.Add(reward);
        }

        var thisWeek = StreakMath.WeekStart(today);
        var lastWeek = thisWeek.AddDays(-7);
        if (reward.LastAwardWeek is null || reward.LastAwardWeek < lastWeek)
        {
            var solves = await CountSolvesAsync(db, userId, lastWeek, thisWeek.AddDays(-1), ct);
            if (solves >= WeeklyGoal)
            {
                reward.Freezes = Math.Min(MaxFreezes, reward.Freezes + 1);
                reward.LastAwardWeek = lastWeek;
            }
        }

        await db.SaveChangesAsync(ct);
        return reward;
    }

    public static async Task<int> CountSolvesAsync(AppDbContext db, string userId, DateOnly from, DateOnly to, CancellationToken ct)
    {
        var words = await db.DailyAttempts.AsNoTracking().CountAsync(a => a.UserId == userId && a.Status == "won" && a.PuzzleDate >= from && a.PuzzleDate <= to, ct);
        var grids = await db.PuzzleAttempts.AsNoTracking().CountAsync(a => a.UserId == userId && a.Status == "solved" && a.PuzzleDate >= from && a.PuzzleDate <= to, ct);
        return words + grids;
    }
}
