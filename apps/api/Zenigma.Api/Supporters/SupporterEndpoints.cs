using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Zenigma.Api.Data;

namespace Zenigma.Api.Supporters;

public record SupporterDto(string Name, int? TotalInr, string Tier);
public record AddSupporterRequest(string? Name, int AmountInr, string? Email, string? Source, bool? ShowAmount);

/// <summary>
/// People who pay for the running costs. The public list shows a name and, if they agreed, an amount, nothing else. Every contribution is
/// recorded by the owner (a call with the admin key, which is off until Support:AdminKey is set), and an account whose email matches gets
/// cosmetic perks as owned items, so they follow the player to every device and work offline.
/// </summary>
public static class SupporterEndpoints
{
    public const int PatronFrom = 500;
    public const int ChampionFrom = 2000;
    private static readonly TimeSpan Fresh = TimeSpan.FromSeconds(60);
    private static (DateTimeOffset At, List<SupporterDto> Value)? _cached;

    public static string TierOf(int totalInr) => totalInr >= ChampionFrom ? "champion" : totalInr >= PatronFrom ? "patron" : "supporter";

    /// <summary>The owned items a tier brings. Never for sale in the store.</summary>
    public static IEnumerable<string> PerksOf(string tier)
    {
        yield return "badge:supporter";
        yield return "accent:patron";
        if (tier is "patron" or "champion")
        {
            yield return "badge:patron";
            yield return "skin:aurora";
        }
        if (tier == "champion") yield return "badge:champion";
    }

    public static void MapSupporters(this IEndpointRouteBuilder app)
    {
        app.MapGet("/public/supporters", async (HttpContext http, AppDbContext db, TimeProvider clock, CancellationToken ct) =>
        {
            http.Response.Headers.CacheControl = "public, max-age=60";
            var now = clock.GetUtcNow();
            if (_cached is { } hit && now - hit.At < Fresh) return Results.Ok(hit.Value);

            var rows = await db.SupporterContributions.AsNoTracking().Select(c => new { c.Name, c.AmountInr, c.ShowAmount }).ToListAsync(ct);
            var list = rows
                .GroupBy(r => r.Name.Trim(), StringComparer.OrdinalIgnoreCase)
                .Select(g =>
                {
                    var total = g.Sum(r => r.AmountInr);
                    return new SupporterDto(g.Key, g.All(r => r.ShowAmount) ? total : null, TierOf(total));
                })
                .OrderByDescending(s => s.TotalInr ?? 0).ThenBy(s => s.Name, StringComparer.OrdinalIgnoreCase)
                .Take(100)
                .ToList();
            _cached = (now, list);
            return Results.Ok(list);
        }).AllowAnonymous();

        app.MapPost("/admin/supporters", async (AddSupporterRequest request, HttpContext http, IConfiguration config, UserManager<ApplicationUser> users, AppDbContext db, TimeProvider clock, CancellationToken ct) =>
        {
            var key = config["Support:AdminKey"];
            var given = http.Request.Headers["X-Admin-Key"].ToString();
            if (string.IsNullOrWhiteSpace(key) || key.Length < 16
                || !CryptographicOperations.FixedTimeEquals(SHA256.HashData(Encoding.UTF8.GetBytes(key)), SHA256.HashData(Encoding.UTF8.GetBytes(given))))
                return Results.NotFound();

            var name = (request.Name ?? "").Trim();
            if (name.Length is 0 or > 40 || request.AmountInr is <= 0 or > 1_000_000)
                return Results.BadRequest(new { error = "A name (up to 40 characters) and a positive amount in rupees are needed." });

            var source = (request.Source ?? "manual").Trim().ToLowerInvariant();
            if (source.Length is 0) source = "manual";
            if (source.Length > 16) source = source[..16];

            ApplicationUser? user = null;
            if (!string.IsNullOrWhiteSpace(request.Email)) user = await users.FindByEmailAsync(request.Email.Trim());

            db.SupporterContributions.Add(new SupporterContribution
            {
                Id = Guid.NewGuid(),
                UserId = user?.Id,
                Name = name,
                AmountInr = request.AmountInr,
                Source = source,
                ShowAmount = request.ShowAmount ?? true,
                CreatedAt = clock.GetUtcNow(),
            });
            await db.SaveChangesAsync(ct);
            _cached = null;

            string? tier = null;
            if (user is not null)
            {
                var total = await db.SupporterContributions.Where(c => c.UserId == user.Id).SumAsync(c => c.AmountInr, ct);
                tier = TierOf(total);
                var have = await db.OwnedItems.Where(o => o.UserId == user.Id).Select(o => o.Item).ToListAsync(ct);
                foreach (var item in PerksOf(tier).Except(have))
                    db.OwnedItems.Add(new OwnedItem { UserId = user.Id, Item = item, CreatedAt = clock.GetUtcNow() });
                await db.SaveChangesAsync(ct);
            }
            return Results.Ok(new { linked = user is not null, tier });
        }).AllowAnonymous();
    }
}
