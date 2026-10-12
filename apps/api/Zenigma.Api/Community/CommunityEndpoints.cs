using Microsoft.EntityFrameworkCore;
using Zenigma.Api.Data;

namespace Zenigma.Api.Community;

public record CommunityDto(int Players, int ActiveToday, int ActiveWeek);

/// <summary>
/// Public, anonymous totals for the home screen: how many people have an account and how many were around lately.
/// Counts only, nothing about any person. Cached for 15 seconds, so a busy home page costs the database a few cheap queries a minute at most.
/// </summary>
public static class CommunityEndpoints
{
    private static readonly TimeSpan Fresh = TimeSpan.FromSeconds(15);
    private static readonly SemaphoreSlim Gate = new(1, 1);
    private static (DateTimeOffset At, CommunityDto Value)? _cached;

    public static void MapCommunity(this IEndpointRouteBuilder app)
    {
        app.MapGet("/public/community", async (AppDbContext db, TimeProvider clock, CancellationToken ct) =>
        {
            var now = clock.GetUtcNow();
            if (_cached is { } hit && now - hit.At < Fresh) return Results.Ok(hit.Value);

            await Gate.WaitAsync(ct);
            try
            {
                if (_cached is { } again && now - again.At < Fresh) return Results.Ok(again.Value);

                var players = await db.Users.AsNoTracking().CountAsync(ct);
                var day = now.AddHours(-24);
                var week = now.AddDays(-7);
                var activeToday = await db.Devices.AsNoTracking().Where(d => d.LastSeenAt >= day).Select(d => d.UserId).Distinct().CountAsync(ct);
                var activeWeek = await db.Devices.AsNoTracking().Where(d => d.LastSeenAt >= week).Select(d => d.UserId).Distinct().CountAsync(ct);

                var value = new CommunityDto(players, activeToday, activeWeek);
                _cached = (now, value);
                return Results.Ok(value);
            }
            finally
            {
                Gate.Release();
            }
        }).AllowAnonymous();
    }
}
