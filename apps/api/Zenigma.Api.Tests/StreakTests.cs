using Zenigma.Api.Streaks;

namespace Zenigma.Api.Tests;

public class StreakMathTests
{
    private static DateOnly D(int day) => new(2026, 10, day);

    [Fact]
    public void No_days_means_no_streak() => Assert.Equal((0, 0), StreakMath.Compute([], D(12)));

    [Fact]
    public void A_run_ending_today_is_current()
    {
        var (current, best) = StreakMath.Compute([D(10), D(11), D(12)], D(12));
        Assert.Equal(3, current);
        Assert.Equal(3, best);
    }

    [Fact]
    public void A_run_ending_yesterday_is_still_alive()
    {
        var (current, _) = StreakMath.Compute([D(9), D(10), D(11)], D(12));
        Assert.Equal(3, current);
    }

    [Fact]
    public void A_missed_day_ends_the_streak_but_keeps_the_best()
    {
        var (current, best) = StreakMath.Compute([D(1), D(2), D(3), D(4), D(8)], D(12));
        Assert.Equal(0, current);
        Assert.Equal(4, best);
    }

    [Fact]
    public void An_earlier_longer_run_does_not_count_as_current()
    {
        var (current, best) = StreakMath.Compute([D(1), D(2), D(3), D(11), D(12)], D(12));
        Assert.Equal(2, current);
        Assert.Equal(3, best);
    }

    [Fact]
    public void Duplicates_are_ignored() => Assert.Equal((2, 2), StreakMath.Compute([D(11), D(11), D(12)], D(12)));

    [Fact]
    public void Weeks_start_on_monday()
    {
        // 12 October 2026 is a Monday.
        Assert.Equal(D(12), StreakMath.WeekStart(D(12)));
        Assert.Equal(D(12), StreakMath.WeekStart(D(18)));
        Assert.Equal(D(5), StreakMath.WeekStart(D(11)));
    }
}

public class GameFreezeTests
{
    [Fact]
    public void Seven_played_days_earn_one_freeze_and_it_is_paid_once()
    {
        var row = new Zenigma.Api.Data.GameFreeze();
        Zenigma.Api.Streaks.StreakService.Credit(row, 6);
        Assert.Equal(0, row.Freezes);
        Zenigma.Api.Streaks.StreakService.Credit(row, 7);
        Zenigma.Api.Streaks.StreakService.Credit(row, 7);
        Assert.Equal(1, row.Freezes);
        Zenigma.Api.Streaks.StreakService.Credit(row, 14);
        Assert.Equal(2, row.Freezes);
    }

    [Fact]
    public void A_game_never_holds_more_than_two_and_counts_days_to_the_next()
    {
        var row = new Zenigma.Api.Data.GameFreeze();
        Zenigma.Api.Streaks.StreakService.Credit(row, 35);
        Assert.Equal(Zenigma.Api.Streaks.StreakService.MaxFreezes, row.Freezes);
        Assert.Equal(7, Zenigma.Api.Streaks.StreakService.DaysToNext(35));
        Assert.Equal(4, Zenigma.Api.Streaks.StreakService.DaysToNext(10));
    }
}
