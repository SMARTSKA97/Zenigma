namespace Zenigma.Api.Infrastructure;

/// <summary>Daily puzzles roll over at 00:00 India Standard Time. IST has no daylight saving, so a fixed offset is exact.</summary>
public static class IstClock
{
    public static readonly TimeSpan Offset = TimeSpan.FromMinutes(330);

    public static DateOnly Today(DateTimeOffset utcNow) => DateOnly.FromDateTime(utcNow.ToOffset(Offset).DateTime);

    public static DateTimeOffset NextRollover(DateTimeOffset utcNow)
    {
        var local = utcNow.ToOffset(Offset);
        return new DateTimeOffset(local.Date.AddDays(1), Offset);
    }
}
