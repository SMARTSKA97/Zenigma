using System.Collections.Concurrent;
using System.Globalization;
using System.Text.Json;

namespace Zenigma.Api.Supporters;

/// <summary>The rupee value of one unit of a currency right now, from a free public rates feed. Cached for an hour; null if it cannot be had.</summary>
public class ExchangeRates(HttpClient http, IConfiguration config, TimeProvider clock, ILogger<ExchangeRates> log)
{
    private static readonly ConcurrentDictionary<string, (DateTimeOffset At, decimal Rate)> Cache = new();

    /// <summary>Rupees for one unit of <paramref name="currency"/> (1 for INR).</summary>
    public async Task<decimal> RateToInrAsync(string currency, CancellationToken ct)
    {
        currency = currency.Trim().ToUpperInvariant();
        if (currency == "INR") return 1m;
        var now = clock.GetUtcNow();
        if (Cache.TryGetValue(currency, out var hit) && now - hit.At < TimeSpan.FromHours(1)) return hit.Rate;
        try
        {
            using var response = await http.GetAsync($"https://open.er-api.com/v6/latest/{Uri.EscapeDataString(currency)}", ct);
            response.EnsureSuccessStatusCode();
            using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
            if (doc.RootElement.TryGetProperty("rates", out var rates) && rates.TryGetProperty("INR", out var inr) && inr.TryGetDecimal(out var rate) && rate > 0)
            {
                Cache[currency] = (now, rate);
                return rate;
            }
        }
        catch (Exception e) when (e is HttpRequestException or TaskCanceledException or JsonException)
        {
            log.LogWarning("Could not fetch the {Currency} rate: {Message}", currency, e.Message);
        }
        // Feed unreachable: the last rate seen, or the owner's own figure, so a payment is still recorded.
        if (Cache.TryGetValue(currency, out var old)) return old.Rate;
        return decimal.TryParse(config["Support:UsdToInr"], NumberStyles.Number, CultureInfo.InvariantCulture, out var fallback) && fallback > 0 ? fallback : 85m;
    }
}
