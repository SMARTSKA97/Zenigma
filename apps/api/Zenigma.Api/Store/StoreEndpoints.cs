using System.Security.Claims;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Zenigma.Api.Auth;
using Zenigma.Api.Data;
using Zenigma.Api.Infrastructure;
using Zenigma.Api.Streaks;

namespace Zenigma.Api.Store;

public record StoreItem(string Id, string Kind, string Name, int Price, int Amount = 0);
public record EarnEntry(Guid? Id, string? Reason, string? Ref);
public record EarnRequest(List<EarnEntry>? Entries);
public record BuyRequest(string? Item);

/// <summary>What the store sells, and what each way of earning pays. The server decides every amount; the app only says what happened.</summary>
public static class StoreCatalog
{
    public const int WelcomeCoins = 20;
    public const int MaxHints = 99;
    /// <summary>Coins that come from things the app reports (levels, quests, the mind set) stop here each India day. Verified dailies and the wheel are outside it.</summary>
    public const int ReportedDailyCap = 60;

    // Prices are set so a colour is a few days of steady play and a full theme is a couple of weeks.
    public static readonly IReadOnlyList<StoreItem> Items =
    [
        new("hints-3", "hints", "3 hints", 40, 3),
        new("hints-10", "hints", "10 hints", 120, 10),
        new("accent:rose", "accent", "Rose", 200),
        new("accent:teal", "accent", "Teal", 200),
        new("accent:coral", "accent", "Coral", 200),
        new("accent:mint", "accent", "Mint", 200),
        new("accent:lime", "accent", "Lime", 260),
        new("accent:sky", "accent", "Sky", 260),
        new("accent:cyan", "accent", "Cyan", 260),
        new("accent:indigo", "accent", "Indigo", 260),
        new("accent:crimson", "accent", "Crimson", 340),
        new("accent:plum", "accent", "Plum", 340),
        new("accent:graphite", "accent", "Graphite", 340),
        new("accent:bronze", "accent", "Bronze", 340),
        new("skin:paper", "skin", "Paper", 700),
        new("skin:sakura", "skin", "Sakura", 700),
        new("skin:lavender", "skin", "Lavender", 800),
        new("skin:mono", "skin", "Mono", 800),
        new("skin:midnight", "skin", "Midnight", 900),
        new("skin:evergreen", "skin", "Evergreen", 900),
        new("skin:dusk", "skin", "Dusk", 1000),
        new("skin:terminal", "skin", "Terminal", 1200),
    ];

    public static StoreItem? Find(string? id) => Items.FirstOrDefault(i => i.Id == id);

    /// <summary>Coins per earn reason. "verified" ones are checked against the player's own results on the server.</summary>
    public static readonly IReadOnlyDictionary<string, int> Earns = new Dictionary<string, int>
    {
        ["daily"] = 5,     // verified: a daily puzzle solved
        ["mindset"] = 12,  // the whole daily mind set
        ["perfect"] = 20,  // puzzles and mind set on the same day
        ["level"] = 1,     // a practice level cleared for the first time
        ["boss"] = 5,      // every tenth level
        ["quest"] = 6,     // a daily quest (the chest pays the same again)
        ["streak"] = 25,   // a streak milestone
    };

    public static readonly IReadOnlyList<(int Weight, string Kind, int Amount)> Wheel =
    [
        (40, "coins", 3), (25, "coins", 5), (13, "coins", 8), (7, "coins", 15),
        (8, "hints", 1), (5, "hints", 2), (2, "coins", 40),
    ];

    public static (string Kind, int Amount) Roll(int roll)
    {
        // roll is 0..99
        var acc = 0;
        foreach (var (weight, kind, amount) in Wheel)
        {
            acc += weight;
            if (roll < acc) return (kind, amount);
        }
        return ("coins", 10);
    }
}

public static partial class StoreEndpoints
{
    [GeneratedRegex("^[a-z0-9:._-]{1,48}$")]
    private static partial Regex RefPattern();

    public static void MapStore(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/store").RequireAuthorization();

        group.MapGet("", async (ClaimsPrincipal principal, AppDbContext db, CancellationToken ct) =>
        {
            var userId = UserIds.Get(principal);
            await EnsureWalletAsync(db, userId, ct);
            return Results.Ok(await StateAsync(db, userId, ct));
        });

        group.MapPost("/earn", async (EarnRequest request, ClaimsPrincipal principal, AppDbContext db, CancellationToken ct) =>
        {
            var userId = UserIds.Get(principal);
            var entries = request.Entries ?? [];
            if (entries.Count > 50) return Results.ValidationProblem(new Dictionary<string, string[]> { ["entries"] = ["At most 50 entries per request."] });
            await EnsureWalletAsync(db, userId, ct);

            var today = IstClock.Today(DateTimeOffset.UtcNow);
            var dayStart = new DateTimeOffset(today.ToDateTime(TimeOnly.MinValue), IstClock.Offset);
            var reported = await db.Database.SqlQueryRaw<int>(
                "SELECT COALESCE(SUM(delta), 0)::int AS \"Value\" FROM coin_ledger WHERE user_id = @u AND created_at >= @t AND reason IN ('mindset','perfect','level','boss','quest','streak')",
                new NpgsqlParameter("u", userId), new NpgsqlParameter("t", dayStart.ToUniversalTime())).FirstAsync(ct);

            var awarded = new List<object>();
            foreach (var e in entries)
            {
                if (e.Id is null || e.Id == Guid.Empty || e.Reason is null || e.Ref is null) continue;
                if (!StoreCatalog.Earns.TryGetValue(e.Reason, out var amount) || !RefPattern().IsMatch(e.Ref)) continue;

                if (e.Reason == "daily")
                {
                    // daily:<game>:<yyyy-mm-dd>, only for a day that player really solved, and only recent days.
                    var parts = e.Ref.Split(':');
                    if (parts.Length != 3 || !DateOnly.TryParseExact(parts[2], "yyyy-MM-dd", out var date)) continue;
                    if (date > today || date < today.AddDays(-2)) continue;
                    var solved = await StreakService.SolvedDatesAsync(db, userId, parts[1], ct);
                    if (!solved.Contains(date)) continue;
                }
                else
                {
                    if (reported + amount > StoreCatalog.ReportedDailyCap) continue;
                }

                var inserted = await db.Database.ExecuteSqlRawAsync(
                    "INSERT INTO coin_ledger (id, user_id, delta, reason, ref) VALUES (@id, @u, @d, @r, @f) ON CONFLICT DO NOTHING",
                    [new NpgsqlParameter("id", e.Id.Value), new NpgsqlParameter("u", userId), new NpgsqlParameter("d", amount), new NpgsqlParameter("r", e.Reason), new NpgsqlParameter("f", e.Ref)],
                    ct);
                if (inserted != 1) continue;
                if (e.Reason != "daily") reported += amount;
                await db.Database.ExecuteSqlRawAsync(
                    "UPDATE coin_balances SET balance = balance + @d, updated_at = now() WHERE user_id = @u",
                    [new NpgsqlParameter("d", amount), new NpgsqlParameter("u", userId)], ct);
                awarded.Add(new { id = e.Id.Value, amount });
            }

            var coins = await db.CoinBalances.AsNoTracking().Where(x => x.UserId == userId).Select(x => x.Balance).FirstAsync(ct);
            return Results.Ok(new { coins, awarded });
        });

        group.MapPost("/wheel", async (ClaimsPrincipal principal, AppDbContext db, CancellationToken ct) =>
        {
            var userId = UserIds.Get(principal);
            await EnsureWalletAsync(db, userId, ct);
            var today = IstClock.Today(DateTimeOffset.UtcNow);
            var prize = StoreCatalog.Roll(Random.Shared.Next(100));

            var inserted = await db.Database.ExecuteSqlRawAsync(
                "INSERT INTO coin_ledger (id, user_id, delta, reason, ref) VALUES (@id, @u, @d, 'wheel', @f) ON CONFLICT DO NOTHING",
                [new NpgsqlParameter("id", Guid.NewGuid()), new NpgsqlParameter("u", userId), new NpgsqlParameter("d", prize.Kind == "coins" ? prize.Amount : 0), new NpgsqlParameter("f", $"wheel:{today:yyyy-MM-dd}")],
                ct);
            if (inserted != 1) return Results.Conflict(new { error = "You already spun today. Come back tomorrow." });

            if (prize.Kind == "coins")
                await db.Database.ExecuteSqlRawAsync("UPDATE coin_balances SET balance = balance + @d, updated_at = now() WHERE user_id = @u",
                    [new NpgsqlParameter("d", prize.Amount), new NpgsqlParameter("u", userId)], ct);
            else
                await AddHintsAsync(db, userId, prize.Amount, ct);

            var state = await StateAsync(db, userId, ct);
            return Results.Ok(new { prize = new { kind = prize.Kind, amount = prize.Amount }, state });
        });

        group.MapPost("/buy", async (BuyRequest request, ClaimsPrincipal principal, AppDbContext db, CancellationToken ct) =>
        {
            var userId = UserIds.Get(principal);
            var item = StoreCatalog.Find(request.Item);
            if (item is null) return Results.NotFound(new { error = "That item is not in the store." });
            await EnsureWalletAsync(db, userId, ct);

            await using var tx = await db.Database.BeginTransactionAsync(ct);
            if (item.Kind == "hints")
            {
                var hints = await db.HintBalances.AsNoTracking().Where(x => x.UserId == userId).Select(x => x.Balance).FirstOrDefaultAsync(ct);
                if (hints + item.Amount > StoreCatalog.MaxHints) return Results.Conflict(new { error = "Your hints are nearly full. Use some first." });
            }
            else if (await db.OwnedItems.AnyAsync(x => x.UserId == userId && x.Item == item.Id, ct))
                return Results.Conflict(new { error = "You already own that." });

            var paid = await db.Database.ExecuteSqlRawAsync(
                "UPDATE coin_balances SET balance = balance - @p, updated_at = now() WHERE user_id = @u AND balance >= @p",
                [new NpgsqlParameter("p", item.Price), new NpgsqlParameter("u", userId)], ct);
            if (paid != 1) return Results.Json(new { error = "Not enough coins yet." }, statusCode: StatusCodes.Status402PaymentRequired);

            await db.Database.ExecuteSqlRawAsync(
                "INSERT INTO coin_ledger (id, user_id, delta, reason, ref) VALUES (@id, @u, @d, 'buy', NULL)",
                [new NpgsqlParameter("id", Guid.NewGuid()), new NpgsqlParameter("u", userId), new NpgsqlParameter("d", -item.Price)], ct);

            if (item.Kind == "hints") await AddHintsAsync(db, userId, item.Amount, ct);
            else
                await db.Database.ExecuteSqlRawAsync("INSERT INTO owned_items (user_id, item) VALUES (@u, @i) ON CONFLICT DO NOTHING",
                    [new NpgsqlParameter("u", userId), new NpgsqlParameter("i", item.Id)], ct);

            await tx.CommitAsync(ct);
            return Results.Ok(await StateAsync(db, userId, ct));
        });
    }

    /// <summary>First contact: a wallet with a small welcome gift, paid once.</summary>
    private static async Task EnsureWalletAsync(AppDbContext db, string userId, CancellationToken ct)
    {
        var created = await db.Database.ExecuteSqlRawAsync(
            "INSERT INTO coin_balances (user_id, balance) VALUES (@u, @b) ON CONFLICT (user_id) DO NOTHING",
            [new NpgsqlParameter("u", userId), new NpgsqlParameter("b", StoreCatalog.WelcomeCoins)], ct);
        if (created == 1)
            await db.Database.ExecuteSqlRawAsync(
                "INSERT INTO coin_ledger (id, user_id, delta, reason, ref) VALUES (@id, @u, @d, 'welcome', 'welcome') ON CONFLICT DO NOTHING",
                [new NpgsqlParameter("id", Guid.NewGuid()), new NpgsqlParameter("u", userId), new NpgsqlParameter("d", StoreCatalog.WelcomeCoins)], ct);
    }

    /// <summary>Hints from the store or the wheel may take the balance past the free-source cap, up to 99.</summary>
    private static Task AddHintsAsync(AppDbContext db, string userId, int count, CancellationToken ct) =>
        db.Database.ExecuteSqlRawAsync(
            "INSERT INTO hint_balances (user_id, balance) VALUES (@u, @n) ON CONFLICT (user_id) DO UPDATE SET balance = LEAST(@max, hint_balances.balance + @n), updated_at = now()",
            [new NpgsqlParameter("u", userId), new NpgsqlParameter("n", count), new NpgsqlParameter("max", StoreCatalog.MaxHints)], ct);

    private static async Task<object> StateAsync(AppDbContext db, string userId, CancellationToken ct)
    {
        var today = IstClock.Today(DateTimeOffset.UtcNow);
        var coins = await db.CoinBalances.AsNoTracking().Where(x => x.UserId == userId).Select(x => x.Balance).FirstOrDefaultAsync(ct);
        var hints = await db.HintBalances.AsNoTracking().Where(x => x.UserId == userId).Select(x => (int?)x.Balance).FirstOrDefaultAsync(ct);
        var owned = await db.OwnedItems.AsNoTracking().Where(x => x.UserId == userId).Select(x => x.Item).ToListAsync(ct);
        var spun = await db.Database.SqlQueryRaw<int>(
            "SELECT COUNT(*)::int AS \"Value\" FROM coin_ledger WHERE user_id = @u AND ref = @r",
            new NpgsqlParameter("u", userId), new NpgsqlParameter("r", $"wheel:{today:yyyy-MM-dd}")).FirstAsync(ct) > 0;
        return new { coins, hints, owned, spunToday = spun, catalog = StoreCatalog.Items, today = today.ToString("yyyy-MM-dd") };
    }
}
