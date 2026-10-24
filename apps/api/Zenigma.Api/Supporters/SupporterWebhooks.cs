using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Zenigma.Api.Data;

namespace Zenigma.Api.Supporters;

/// <summary>
/// Payments reported by GitHub Sponsors and Buy me a coffee. Each call is signed with a secret only the sender and this API know; anything
/// else is refused. Amounts are shown on the thank-you list only if the owner flips them on, since a tip does not say the amount may be public.
/// </summary>
public static class SupporterWebhooks
{
    private static async Task<byte[]?> ReadBodyAsync(HttpRequest request, CancellationToken ct)
    {
        if (request.ContentLength is > 65_536) return null;
        using var ms = new MemoryStream();
        await request.Body.CopyToAsync(ms, ct);
        return ms.Length > 65_536 ? null : ms.ToArray();
    }

    private static bool SignatureMatches(string secret, byte[] body, string given)
    {
        given = given.Trim();
        if (given.StartsWith("sha256=", StringComparison.OrdinalIgnoreCase)) given = given[7..];
        if (given.Length == 0) return false;
        var mac = HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), body);
        var hex = Convert.ToHexString(mac);
        var b64 = Convert.ToBase64String(mac);
        return Same(hex, given, ignoreCase: true) || Same(b64, given, ignoreCase: false);
    }

    private static bool Same(string expected, string given, bool ignoreCase)
    {
        if (ignoreCase) (expected, given) = (expected.ToLowerInvariant(), given.ToLowerInvariant());
        var a = Encoding.UTF8.GetBytes(expected);
        var b = Encoding.UTF8.GetBytes(given);
        return a.Length == b.Length && CryptographicOperations.FixedTimeEquals(a, b);
    }

    /// <summary>The rupees a payment was worth at the moment it came in, and the rate used (null for rupees).</summary>
    private static async Task<(int Inr, decimal? Rate)> ToInrAsync(decimal amount, string currency, ExchangeRates rates, CancellationToken ct)
    {
        if (string.Equals(currency, "INR", StringComparison.OrdinalIgnoreCase)) return ((int)Math.Clamp(Math.Round(amount), 1, 1_000_000), null);
        var rate = await rates.RateToInrAsync(currency, ct);
        return ((int)Math.Clamp(Math.Round(amount * rate), 1, 1_000_000), rate);
    }

    private static string? Str(JsonElement e, string name) =>
        e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var v) && v.ValueKind is JsonValueKind.String ? v.GetString()
        : e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var n) && n.ValueKind is JsonValueKind.Number ? n.GetRawText() : null;

    private static decimal? Num(JsonElement e, string name)
    {
        if (e.ValueKind != JsonValueKind.Object || !e.TryGetProperty(name, out var v)) return null;
        if (v.ValueKind == JsonValueKind.Number && v.TryGetDecimal(out var d)) return d;
        if (v.ValueKind == JsonValueKind.String && decimal.TryParse(v.GetString(), System.Globalization.NumberStyles.Number, System.Globalization.CultureInfo.InvariantCulture, out var s)) return s;
        return null;
    }

    private static string CleanName(string? name, string fallback)
    {
        var n = (name ?? "").Trim();
        if (n.Length == 0) n = fallback;
        return n.Length > 40 ? n[..40] : n;
    }

    public static void MapSupporterWebhooks(this IEndpointRouteBuilder app)
    {
        // GitHub Sponsors: Settings of the sponsors dashboard > Webhooks. Content type application/json, event "Sponsorships".
        app.MapPost("/webhooks/github-sponsors", async (HttpRequest request, IConfiguration config, UserManager<ApplicationUser> users, AppDbContext db, ExchangeRates rates, TimeProvider clock, ILoggerFactory loggers, CancellationToken ct) =>
        {
            var secret = config["Support:GithubWebhookSecret"];
            if (string.IsNullOrWhiteSpace(secret)) return Results.NotFound();
            var body = await ReadBodyAsync(request, ct);
            if (body is null || !SignatureMatches(secret, body, request.Headers["X-Hub-Signature-256"].ToString())) return Results.Unauthorized();
            var eventName = request.Headers["X-GitHub-Event"].ToString();
            if (eventName != "sponsorship") return Results.Ok(new { ignored = eventName });

            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;
            // Only a new sponsorship is recorded; GitHub does not send an event for each monthly renewal.
            if (Str(root, "action") != "created") return Results.Ok(new { ignored = Str(root, "action") });
            if (!root.TryGetProperty("sponsorship", out var sp)) return Results.BadRequest();
            var login = sp.TryGetProperty("sponsor", out var sponsor) ? Str(sponsor, "login") : null;
            var tier = sp.TryGetProperty("tier", out var t) ? t : default;
            var dollars = Num(tier, "monthly_price_in_dollars") ?? (Num(tier, "monthly_price_in_cents") ?? 0) / 100m;
            if (dollars <= 0) return Results.Ok(new { ignored = "no amount" });
            var isPrivate = string.Equals(Str(sp, "privacy_level"), "private", StringComparison.OrdinalIgnoreCase);
            var name = isPrivate ? "A kind supporter" : CleanName(login, "A kind supporter");
            var delivery = request.Headers["X-GitHub-Delivery"].ToString();
            var id = "gh:" + (delivery.Length > 0 ? delivery : Convert.ToHexString(SHA256.HashData(body))[..32]);
            var (ghInr, ghRate) = await ToInrAsync(dollars, "USD", rates, ct);
            await SupporterRecorder.RecordAsync(db, users, clock, name, ghInr, "github", false, null, id[..Math.Min(64, id.Length)], ct, "USD", dollars, ghRate);
            loggers.CreateLogger("Supporters").LogInformation("Recorded a GitHub sponsorship");
            return Results.Ok(new { recorded = true });
        }).AllowAnonymous();

        // Buy me a coffee: Developer > Webhooks. The payload names differ a little between their event types, so this reads what is there.
        app.MapPost("/webhooks/buymeacoffee", async (HttpRequest request, IConfiguration config, UserManager<ApplicationUser> users, AppDbContext db, ExchangeRates rates, TimeProvider clock, ILoggerFactory loggers, CancellationToken ct) =>
        {
            var secret = config["Support:BmcWebhookSecret"];
            if (string.IsNullOrWhiteSpace(secret)) return Results.NotFound();
            var body = await ReadBodyAsync(request, ct);
            var given = request.Headers["X-Signature-Sha256"].ToString();
            if (given.Length == 0) given = request.Headers["X-Bmc-Signature"].ToString();
            var log = loggers.CreateLogger("Supporters");
            if (body is null || !SignatureMatches(secret, body, given))
            {
                log.LogWarning("Buy me a coffee webhook refused (signature header present: {Present})", given.Length > 0);
                return Results.Unauthorized();
            }

            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;
            var data = root.ValueKind == JsonValueKind.Object && root.TryGetProperty("data", out var d1) ? d1
                : root.ValueKind == JsonValueKind.Object && root.TryGetProperty("response", out var d2) ? d2 : root;
            var type = (Str(root, "type") ?? request.Headers["X-Bmc-Event"].ToString()).ToLowerInvariant();
            if (new[] { "cancel", "end", "refund", "delete", "update", "test" }.Any(w => type.Contains(w)))
                return Results.Ok(new { ignored = type });

            var amount = Num(data, "amount") ?? Num(data, "total_amount") ?? 0;
            if (amount <= 0) return Results.Ok(new { ignored = "no amount" });
            var currency = Str(data, "currency") ?? "USD";
            currency = currency.Trim().ToUpperInvariant();
            if (currency.Length != 3) currency = "USD";
            var (inr, rate) = await ToInrAsync(amount, currency, rates, ct);
            var name = CleanName(Str(data, "supporter_name"), "A kind supporter");
            var email = Str(data, "supporter_email") ?? Str(data, "payer_email");
            var raw = Str(data, "id") ?? Str(data, "transaction_id") ?? Str(root, "id");
            var id = "bmc:" + (raw ?? Convert.ToHexString(SHA256.HashData(body))[..32]);
            var (linked, tier) = await SupporterRecorder.RecordAsync(db, users, clock, name, inr, "coffee", false, email, id[..Math.Min(64, id.Length)], ct, currency, rate is null ? null : amount, rate);
            log.LogInformation("Recorded a Buy me a coffee payment (account linked: {Linked})", linked);
            return Results.Ok(new { recorded = true, linked, tier });
        }).AllowAnonymous();
    }
}
