using System.Security.Cryptography;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Zenigma.Api.Auth;
using Zenigma.Api.Data;

namespace Zenigma.Api.Leaderboards;

public class CircleRow
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public string Code { get; set; } = "";
    public bool IsOwner { get; set; }
    public int Members { get; set; }
}

public record CircleDto(Guid Id, string Name, string Code, bool IsOwner, int Members);
public record CreateCircleRequest(string? Name);
public record JoinCircleRequest(string? Code);

/// <summary>Private friend groups. A circle is joined with a short code; its leaderboards are the global ones filtered to members.</summary>
public static class CircleEndpoints
{
    public const int MaxCirclesPerUser = 10;
    public const int MaxMembers = 50;
    // No 0/O/1/I so codes survive being read aloud.
    private const string CodeAlphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

    public static string NewCode()
    {
        Span<char> chars = stackalloc char[6];
        for (var i = 0; i < chars.Length; i++) chars[i] = CodeAlphabet[RandomNumberGenerator.GetInt32(CodeAlphabet.Length)];
        return new string(chars);
    }

    public static string? CleanName(string? name)
    {
        var n = string.Join(' ', (name ?? "").Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        return n.Length is >= 2 and <= 40 ? n : null;
    }

    private const string ListSql = """
        SELECT c.id AS "Id", c.name AS "Name", c.code AS "Code", (c.owner_id = @u) AS "IsOwner",
               (SELECT COUNT(*)::int FROM circle_members m2 WHERE m2.circle_id = c.id) AS "Members"
        FROM circles c JOIN circle_members m ON m.circle_id = c.id AND m.user_id = @u
        """;

    public static void MapCircles(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/circles").RequireAuthorization();

        group.MapGet("", async (ClaimsPrincipal principal, AppDbContext db, CancellationToken ct) =>
            Results.Ok(await ListAsync(db, UserIds.Get(principal), null, ct)));

        group.MapPost("", async (CreateCircleRequest body, ClaimsPrincipal principal, AppDbContext db, CancellationToken ct) =>
        {
            var name = CleanName(body.Name);
            if (name is null) return Results.BadRequest(new { error = "Give the circle a name of 2 to 40 characters." });
            var me = UserIds.Get(principal);
            if (await CountAsync(db, me, ct) >= MaxCirclesPerUser) return Results.BadRequest(new { error = $"You can be in up to {MaxCirclesPerUser} circles." });

            for (var attempt = 0; attempt < 5; attempt++)
            {
                var id = Guid.NewGuid();
                var code = NewCode();
                try
                {
                    await db.Database.ExecuteSqlRawAsync(
                        "INSERT INTO circles (id, name, code, owner_id) VALUES (@id, @n, @c, @u); INSERT INTO circle_members (circle_id, user_id) VALUES (@id, @u)",
                        [new NpgsqlParameter("id", id), new NpgsqlParameter("n", name), new NpgsqlParameter("c", code), new NpgsqlParameter("u", me)], ct);
                    return Results.Ok((await ListAsync(db, me, id, ct)).Single());
                }
                catch (PostgresException e) when (e.SqlState == "23505") { }
            }
            return Results.Problem("Could not create the circle. Try again.");
        });

        group.MapPost("join", async (JoinCircleRequest body, ClaimsPrincipal principal, AppDbContext db, CancellationToken ct) =>
        {
            var code = (body.Code ?? "").Trim().ToUpperInvariant();
            if (code.Length != 6) return Results.BadRequest(new { error = "Codes are 6 characters." });
            var me = UserIds.Get(principal);

            var found = await db.Database.SqlQueryRaw<Guid>("SELECT id AS \"Value\" FROM circles WHERE code = @c", new NpgsqlParameter("c", code)).ToListAsync(ct);
            if (found.Count == 0) return Results.NotFound(new { error = "No circle has that code." });
            var id = found[0];

            var already = await db.Database.SqlQueryRaw<int>("SELECT 1 AS \"Value\" FROM circle_members WHERE circle_id = @c AND user_id = @u",
                new NpgsqlParameter("c", id), new NpgsqlParameter("u", me)).AnyAsync(ct);
            if (!already)
            {
                if (await CountAsync(db, me, ct) >= MaxCirclesPerUser) return Results.BadRequest(new { error = $"You can be in up to {MaxCirclesPerUser} circles." });
                var size = (await db.Database.SqlQueryRaw<int>("SELECT COUNT(*)::int AS \"Value\" FROM circle_members WHERE circle_id = @c", new NpgsqlParameter("c", id)).ToListAsync(ct))[0];
                if (size >= MaxMembers) return Results.BadRequest(new { error = "That circle is full." });
                await db.Database.ExecuteSqlRawAsync("INSERT INTO circle_members (circle_id, user_id) VALUES (@c, @u) ON CONFLICT DO NOTHING",
                    [new NpgsqlParameter("c", id), new NpgsqlParameter("u", me)], ct);
            }
            return Results.Ok((await ListAsync(db, me, id, ct)).Single());
        });

        group.MapDelete("{id:guid}", async (Guid id, ClaimsPrincipal principal, AppDbContext db, CancellationToken ct) =>
        {
            // Leaving; the last member leaving removes the circle.
            var me = UserIds.Get(principal);
            var left = await db.Database.ExecuteSqlRawAsync("DELETE FROM circle_members WHERE circle_id = @c AND user_id = @u",
                [new NpgsqlParameter("c", id), new NpgsqlParameter("u", me)], ct);
            if (left == 0) return Results.NotFound();
            await db.Database.ExecuteSqlRawAsync("DELETE FROM circles c WHERE c.id = @c AND NOT EXISTS (SELECT 1 FROM circle_members m WHERE m.circle_id = c.id)",
                [new NpgsqlParameter("c", id)], ct);
            return Results.NoContent();
        });
    }

    private static async Task<List<CircleDto>> ListAsync(AppDbContext db, string me, Guid? only, CancellationToken ct)
    {
        var sql = ListSql + (only is null ? "" : " WHERE c.id = @only") + " ORDER BY m.joined_at";
        var args = new List<NpgsqlParameter> { new("u", me) };
        if (only is not null) args.Add(new NpgsqlParameter("only", only.Value));
        var rows = await db.Database.SqlQueryRaw<CircleRow>(sql, [.. args]).ToListAsync(ct);
        return rows.Select(r => new CircleDto(r.Id, r.Name, r.Code, r.IsOwner, r.Members)).ToList();
    }

    private static async Task<int> CountAsync(AppDbContext db, string me, CancellationToken ct) =>
        (await db.Database.SqlQueryRaw<int>("SELECT COUNT(*)::int AS \"Value\" FROM circle_members WHERE user_id = @u", new NpgsqlParameter("u", me)).ToListAsync(ct))[0];
}
