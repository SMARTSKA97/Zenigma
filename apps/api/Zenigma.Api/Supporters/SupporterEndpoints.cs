using System.Security.Cryptography;
using System.Text;
using System.Collections.Concurrent;
using System.Net;
using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Zenigma.Api.Auth;
using Microsoft.EntityFrameworkCore;
using Zenigma.Api.Data;

namespace Zenigma.Api.Supporters;

public record SupporterDto(string Name, int? TotalInr, string Tier);
public record ClaimRequest(string? Name, int AmountInr, string? Method);
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

    private static readonly ConcurrentDictionary<string, (DateOnly Day, int Count)> Claims = new();
    private static readonly string[] Methods = ["upi", "github", "coffee", "other"];

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

        // "I supported": a signed-in player tells the owner, who checks the payment in their own app and records it. Nothing is granted here.
        app.MapPost("/support/claim", async (ClaimRequest request, ClaimsPrincipal principal, IConfiguration config, IEmailSender email, UserManager<ApplicationUser> users, TimeProvider clock, CancellationToken ct) =>
        {
            var to = config["Support:NotifyEmail"];
            if (string.IsNullOrWhiteSpace(to) || !email.Enabled)
                return Results.Json(new { error = "This is not available right now." }, statusCode: StatusCodes.Status503ServiceUnavailable);
            if (request.AmountInr is <= 0 or > 1_000_000)
                return Results.BadRequest(new { error = "Enter the amount you sent, in rupees." });
            var method = Methods.Contains((request.Method ?? "").ToLowerInvariant()) ? request.Method!.ToLowerInvariant() : "other";
            var name = (request.Name ?? "").Trim();
            if (name.Length > 40) name = name[..40];

            var userId = UserIds.Get(principal);
            var user = await users.FindByIdAsync(userId);
            if (user is null) return Results.Unauthorized();

            var today = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
            var entry = Claims.AddOrUpdate(userId, _ => (today, 1), (_, old) => old.Day == today ? (today, old.Count + 1) : (today, 1));
            if (entry.Count > 3) return Results.Json(new { error = "That is enough for today. Thank you!" }, statusCode: StatusCodes.Status429TooManyRequests);

            var shown = name.Length > 0 ? name : (user.DisplayName ?? "Player");
            var amount = request.AmountInr;
            var plain = shown.Replace("\"", "").Replace("'", "");
            var text = $"{shown} ({user.Email}) says they sent Rs {amount} by {method}. Check it in your payment app, then record it:\n\n" +
                       $"curl -X POST <api>/admin/supporters -H \"X-Admin-Key: <key>\" -H \"Content-Type: application/json\" -d '{{\"name\":\"{plain}\",\"amountInr\":{amount},\"email\":\"{user.Email}\",\"source\":\"{method}\"}}'";
            var html = $"<p><b>{WebUtility.HtmlEncode(shown)}</b> ({WebUtility.HtmlEncode(user.Email)}) says they sent <b>Rs {amount}</b> by {method}.</p><p>Check it in your payment app, then record it with the call below.</p><pre>{WebUtility.HtmlEncode(text.Substring(text.IndexOf("curl", StringComparison.Ordinal)))}</pre>";
            var sent = await email.SendAsync(to, $"Zenigma support: Rs {amount} from {shown}", text, html, ct);
            return sent ? Results.Ok(new { sent = true }) : Results.Json(new { error = "Could not send that. Please try again later." }, statusCode: StatusCodes.Status502BadGateway);
        }).RequireAuthorization();

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
