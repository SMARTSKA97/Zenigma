using System.Security.Claims;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Zenigma.Api.Auth;
using Zenigma.Api.Data;

namespace Zenigma.Api.Hints;

public record HintEntryDto(Guid? Id, int Delta, string? Reason);
public record HintSyncRequest(List<HintEntryDto>? Entries, int? LocalBalance);
public record HintBalanceDto(int? Balance);

/// <summary>
/// The hint balance for signed-in players. The app keeps playing from its own copy and sends what was earned or spent as ledger
/// entries; the server applies each entry once (keyed by its id) and answers with the balance every device should show.
/// Hints that come from free sources never pile up beyond <see cref="FreeCap"/>.
/// </summary>
public static partial class HintsEndpoints
{
    public const int FreeCap = 10;
    public const int MaxEntries = 100;

    [GeneratedRegex("^[a-z0-9._-]{1,24}$")]
    private static partial Regex ReasonPattern();

    public static string? Validate(HintEntryDto e)
    {
        if (e.Id is null || e.Id == Guid.Empty) return "Missing id.";
        if (e.Delta == 0 || e.Delta < -1 || e.Delta > 3) return "A hint entry is a spend (-1) or an earn (1 to 3).";
        if (e.Reason is null || !ReasonPattern().IsMatch(e.Reason)) return "Invalid reason.";
        return null;
    }

    public static void MapHints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/hints").RequireAuthorization();

        group.MapGet("", async (ClaimsPrincipal principal, AppDbContext db, CancellationToken ct) =>
        {
            var userId = UserIds.Get(principal);
            var row = await db.HintBalances.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == userId, ct);
            return Results.Ok(new HintBalanceDto(row?.Balance));
        });

        group.MapPost("/sync", async (HintSyncRequest request, ClaimsPrincipal principal, AppDbContext db, CancellationToken ct) =>
        {
            var userId = UserIds.Get(principal);
            var entries = request.Entries ?? [];
            if (entries.Count > MaxEntries)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["entries"] = [$"At most {MaxEntries} entries per sync."] });

            // First contact: the device's balance (guest hints included) becomes the account's balance.
            var start = Math.Clamp(request.LocalBalance ?? 0, 0, FreeCap);
            var created = await db.Database.ExecuteSqlRawAsync(
                "INSERT INTO hint_balances (user_id, balance) VALUES (@u, @b) ON CONFLICT (user_id) DO NOTHING",
                [new NpgsqlParameter("u", userId), new NpgsqlParameter("b", start)],
                ct);

            foreach (var e in entries)
            {
                if (Validate(e) is not null) continue;
                var inserted = await db.Database.ExecuteSqlRawAsync(
                    "INSERT INTO hint_ledger (id, user_id, delta, reason) VALUES (@id, @u, @d, @r) ON CONFLICT (user_id, id) DO NOTHING",
                    [new NpgsqlParameter("id", e.Id!.Value), new NpgsqlParameter("u", userId), new NpgsqlParameter("d", e.Delta), new NpgsqlParameter("r", e.Reason!)],
                    ct);
                // The row just made already includes this device's own entries, so only an existing balance is moved by them.
                if (inserted == 1 && created == 0)
                {
                    await db.Database.ExecuteSqlRawAsync(
                        "UPDATE hint_balances SET balance = LEAST(@cap, GREATEST(0, balance + @d)), updated_at = now() WHERE user_id = @u",
                        [new NpgsqlParameter("cap", FreeCap), new NpgsqlParameter("d", e.Delta), new NpgsqlParameter("u", userId)],
                        ct);
                }
            }

            var row = await db.HintBalances.AsNoTracking().FirstAsync(x => x.UserId == userId, ct);
            return Results.Ok(new HintBalanceDto(row.Balance));
        });
    }
}
