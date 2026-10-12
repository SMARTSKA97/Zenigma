namespace Zenigma.Api.Streaks;

/// <summary>Pure streak arithmetic, so the rules can be tested without a database.</summary>
public static class StreakMath
{
    /// <summary>
    /// Current and best streak over the days a game was solved (or covered by a freeze). A streak is still alive when its
    /// last day is today or yesterday; once a whole day passes without a result it is over.
    /// </summary>
    public static (int Current, int Best) Compute(IEnumerable<DateOnly> days, DateOnly today)
    {
        var sorted = days.Distinct().OrderBy(d => d).ToList();
        if (sorted.Count == 0) return (0, 0);

        var best = 1;
        var run = 1;
        for (var i = 1; i < sorted.Count; i++)
        {
            run = sorted[i].DayNumber - sorted[i - 1].DayNumber == 1 ? run + 1 : 1;
            best = Math.Max(best, run);
        }

        // `run` now holds the length of the run that ends at the last day.
        var last = sorted[^1];
        var current = today.DayNumber - last.DayNumber <= 1 ? run : 0;
        return (current, best);
    }

    /// <summary>The Monday of the week a date falls in.</summary>
    public static DateOnly WeekStart(DateOnly date) => date.AddDays(-(((int)date.DayOfWeek + 6) % 7));
}
