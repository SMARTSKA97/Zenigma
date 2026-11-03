using Microsoft.EntityFrameworkCore;
using Zenigma.Api.Data;

namespace Zenigma.Api.Auth;

public record DeviceDto(Guid Id, string Name, DateTimeOffset LastUsedAt, bool Current);

/// <summary>
/// The devices a player is signed in on: one per device id that holds a live session. A free account may be signed in on one device,
/// a supporter (anyone who has contributed) on five. The limit applies when a device signs in, never to a session that already exists.
/// </summary>
public sealed class DeviceService(AppDbContext db, TimeProvider clock)
{
    public const int FreeLimit = 1;
    public const int SupporterLimit = 5;

    public async Task<int> LimitAsync(string userId, CancellationToken ct) =>
        await db.SupporterContributions.AnyAsync(c => c.UserId == userId && c.AmountInr > 0, ct) ? SupporterLimit : FreeLimit;

    public async Task<List<DeviceDto>> ActiveAsync(string userId, Guid? current, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var live = await db.RefreshTokens.AsNoTracking()
            .Where(t => t.UserId == userId && t.RevokedAt == null && t.ExpiresAt > now)
            .ToListAsync(ct);
        // A session from before devices were tracked has no id; it counts as a device of its own.
        return live.GroupBy(t => t.DeviceId ?? t.Id)
            .Select(g => g.OrderByDescending(t => t.LastUsedAt ?? t.CreatedAt).First())
            .Select(t => new DeviceDto(t.DeviceId ?? t.Id, t.DeviceName ?? "Unknown device", t.LastUsedAt ?? t.CreatedAt, current is { } c && (t.DeviceId ?? t.Id) == c))
            .OrderByDescending(d => d.Current).ThenByDescending(d => d.LastUsedAt)
            .ToList();
    }

    /// <summary>Null when this device may sign in. Otherwise the 409 answer that lists the other devices so the player can pick one to sign out.</summary>
    public async Task<IResult?> GateAsync(string userId, Guid? deviceId, Guid? replaceId, CancellationToken ct)
    {
        var limit = await LimitAsync(userId, ct);
        var others = (await ActiveAsync(userId, deviceId, ct)).Where(d => deviceId is null || d.Id != deviceId).ToList();
        if (others.Count < limit) return null;
        if (replaceId is { } r && others.Any(d => d.Id == r))
        {
            await SignOutAsync(userId, r, ct);
            others.RemoveAll(d => d.Id == r);
            if (others.Count < limit) return null;
        }
        return Results.Json(new { code = "device-limit", title = "This account is signed in on too many devices.", limit, devices = others }, statusCode: StatusCodes.Status409Conflict);
    }

    public async Task SignOutAsync(string userId, Guid deviceId, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        await db.RefreshTokens
            .Where(t => t.UserId == userId && t.RevokedAt == null && (t.DeviceId == deviceId || (t.DeviceId == null && t.Id == deviceId)))
            .ExecuteUpdateAsync(set => set.SetProperty(t => t.RevokedAt, now).SetProperty(t => t.EndedByUser, true), ct);
    }

    /// <summary>Ends every session except the one on <paramref name="keep"/> (or all of them, when it is null).</summary>
    public async Task SignOutAllAsync(string userId, Guid? keep, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        await db.RefreshTokens
            .Where(t => t.UserId == userId && t.RevokedAt == null && (keep == null || t.DeviceId == null || t.DeviceId != keep))
            .ExecuteUpdateAsync(set => set.SetProperty(t => t.RevokedAt, now).SetProperty(t => t.EndedByUser, true), ct);
    }
}
