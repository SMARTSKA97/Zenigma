using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Zenigma.Api.Data;

namespace Zenigma.Api.Supporters;

/// <summary>Shared by the owner's call and the payment webhooks: write one contribution and switch on the perks of the account it belongs to.</summary>
public static class SupporterRecorder
{
    public static bool IsAdmin(HttpContext http, IConfiguration config)
    {
        var key = config["Support:AdminKey"];
        var given = http.Request.Headers["X-Admin-Key"].ToString();
        return !string.IsNullOrWhiteSpace(key) && key.Length >= 16
            && CryptographicOperations.FixedTimeEquals(SHA256.HashData(Encoding.UTF8.GetBytes(key)), SHA256.HashData(Encoding.UTF8.GetBytes(given)));
    }

    public static void Forget() => SupporterEndpoints._cached = null;

    /// <summary>Records a contribution (once per external id). Returns whether it reached an account, and that account's tier.</summary>
    public static async Task<(bool Linked, string? Tier)> RecordAsync(
        AppDbContext db, UserManager<ApplicationUser> users, TimeProvider clock,
        string name, int amountInr, string source, bool showAmount, string? email, string? externalId, CancellationToken ct,
        string currency = "INR", decimal? original = null, decimal? rate = null)
    {
        if (externalId is not null && await db.SupporterContributions.AnyAsync(c => c.ExternalId == externalId, ct)) return (false, null);

        ApplicationUser? user = null;
        if (!string.IsNullOrWhiteSpace(email)) user = await users.FindByEmailAsync(email.Trim());

        db.SupporterContributions.Add(new SupporterContribution
        {
            Id = Guid.NewGuid(),
            UserId = user?.Id,
            Name = name,
            AmountInr = amountInr,
            Currency = currency,
            OriginalAmount = original,
            RateToInr = rate,
            Source = source,
            ShowAmount = showAmount,
            ExternalId = externalId,
            CreatedAt = clock.GetUtcNow(),
        });
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException) when (externalId is not null)
        {
            return (false, null); // the same delivery arrived twice at once
        }
        Forget();
        return (user is not null, user is null ? null : await GrantAsync(db, user.Id, clock, ct));
    }

    /// <summary>Gives an account the perks its total earns. Returns the tier.</summary>
    public static async Task<string?> GrantAsync(AppDbContext db, string userId, TimeProvider clock, CancellationToken ct)
    {
        var total = await db.SupporterContributions.Where(c => c.UserId == userId).SumAsync(c => c.AmountInr, ct);
        if (total <= 0) return null;
        var tier = SupporterEndpoints.TierOf(total);
        var have = await db.OwnedItems.Where(o => o.UserId == userId).Select(o => o.Item).ToListAsync(ct);
        foreach (var item in SupporterEndpoints.PerksOf(tier).Except(have))
            db.OwnedItems.Add(new OwnedItem { UserId = userId, Item = item, CreatedAt = clock.GetUtcNow() });
        await db.SaveChangesAsync(ct);
        return tier;
    }
}
