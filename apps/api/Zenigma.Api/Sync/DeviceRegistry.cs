using Microsoft.EntityFrameworkCore;
using Zenigma.Api.Data;

namespace Zenigma.Api.Sync;

public static class DeviceRegistry
{
    /// <summary>Registers a device for a user, or refreshes it. Returns false when the id already belongs to another account.</summary>
    public static async Task<bool> RegisterAsync(AppDbContext db, string userId, Guid deviceId, string platform, CancellationToken ct)
    {
        var rows = await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO devices (id, user_id, platform) VALUES ({deviceId}, {userId}, {platform})
            ON CONFLICT (id) DO UPDATE SET last_seen_at = now(), platform = EXCLUDED.platform
            WHERE devices.user_id = EXCLUDED.user_id
            """, ct);
        return rows > 0;
    }
}
