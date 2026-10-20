using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Zenigma.Api.Data;

namespace Zenigma.Api.Auth;

/// <summary>
/// Six-digit codes that prove a person can read an email address. A code is stored only as a keyed hash, works once, lasts
/// 15 minutes and locks after 5 wrong tries; new codes are limited to one a minute and five an hour per person and purpose.
/// </summary>
public class EmailCodeService(AppDbContext db, IOptions<JwtOptions> jwt, TimeProvider clock, IConfiguration config)
{
    public const string Verify = "verify";
    public const string Reset = "reset";
    private const int MaxAttempts = 5;
    /// <summary>
    /// Codes sent in a day across everyone (<c>Email:DailyBudget</c>, default 250). Brevo's free plan allows 300 emails a day,
    /// shared by every app using the account, so lower it if other apps send too.
    /// </summary>
    private int DailyBudget => config.GetValue("Email:DailyBudget", 250);
    private static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(15);

    /// <summary>True when today's email budget is used up. It is the same for everyone, so asking reveals nothing about any one account.</summary>
    public async Task<bool> BudgetFullAsync(CancellationToken ct) =>
        await db.EmailCodes.CountAsync(c => c.CreatedAt > clock.GetUtcNow().AddDays(-1), ct) >= DailyBudget;

    /// <summary>Makes a fresh code for the person (replacing any earlier one). Null when they asked too often.</summary>
    public async Task<string?> IssueAsync(string userId, string purpose, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var recent = await db.EmailCodes.AsNoTracking()
            .Where(c => c.UserId == userId && c.Purpose == purpose && c.CreatedAt > now.AddHours(-1))
            .Select(c => c.CreatedAt).ToListAsync(ct);
        if (recent.Count >= 5 || recent.Any(t => t > now.AddSeconds(-60))) return null;
        if (await db.EmailCodes.CountAsync(c => c.CreatedAt > now.AddDays(-1), ct) >= DailyBudget) return null;

        await db.EmailCodes.Where(c => c.UserId == userId && c.Purpose == purpose && c.UsedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(c => c.UsedAt, now), ct);
        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
        db.EmailCodes.Add(new EmailCode { Id = Guid.NewGuid(), UserId = userId, Purpose = purpose, CodeHash = Hash(userId, purpose, code), CreatedAt = now, ExpiresAt = now + Lifetime });
        await db.SaveChangesAsync(ct);
        return code;
    }

    /// <summary>Checks a code. True once, if it is the latest, unexpired and has not run out of tries.</summary>
    public async Task<bool> ConsumeAsync(string userId, string purpose, string? code, CancellationToken ct)
    {
        if (code is not { Length: 6 } || !code.All(char.IsAsciiDigit)) return false;
        var now = clock.GetUtcNow();
        var latest = await db.EmailCodes.AsNoTracking()
            .Where(c => c.UserId == userId && c.Purpose == purpose && c.UsedAt == null && c.ExpiresAt > now)
            .OrderByDescending(c => c.CreatedAt).FirstOrDefaultAsync(ct);
        if (latest is null) return false;

        // Count the try first, atomically, so parallel guesses cannot beat the limit.
        var counted = await db.EmailCodes.Where(c => c.Id == latest.Id && c.UsedAt == null && c.Attempts < MaxAttempts)
            .ExecuteUpdateAsync(s => s.SetProperty(c => c.Attempts, c => c.Attempts + 1), ct);
        if (counted != 1) return false;

        var expected = Encoding.ASCII.GetBytes(latest.CodeHash);
        var given = Encoding.ASCII.GetBytes(Hash(userId, purpose, code));
        if (!CryptographicOperations.FixedTimeEquals(expected, given)) return false;

        var used = await db.EmailCodes.Where(c => c.Id == latest.Id && c.UsedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(c => c.UsedAt, now), ct);
        return used == 1;
    }

    private string Hash(string userId, string purpose, string code)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(jwt.Value.Key));
        return Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes($"{userId}:{purpose}:{code}")));
    }
}
