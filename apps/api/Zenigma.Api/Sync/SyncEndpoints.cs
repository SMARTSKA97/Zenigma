using System.Security.Claims;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using NpgsqlTypes;
using Zenigma.Api.Auth;
using Zenigma.Api.Data;

namespace Zenigma.Api.Sync;

public record PushEventDto(Guid? Id, string? Kind, JsonElement Payload, DateTimeOffset? ClientCreatedAt);
public record PushRequest(Guid? DeviceId, string? Platform, List<PushEventDto>? Events);
public record RejectedDto(Guid Id, string Reason);
public record PushResponse(List<Guid> Accepted, List<Guid> Duplicates, List<RejectedDto> Rejected);

public record PulledEventDto(
    long Seq, Guid Id, Guid DeviceId, string Kind, JsonElement Payload, DateTimeOffset ClientCreatedAt, DateTimeOffset ReceivedAt);
public record PullResponse(List<PulledEventDto> Events, long NextCursor, bool HasMore);

public static partial class SyncEndpoints
{
    public const int MaxBatch = 200;
    public const int MaxPayloadBytes = 16 * 1024;

    [GeneratedRegex("^[a-z0-9][a-z0-9._-]{0,63}$")]
    private static partial Regex KindPattern();

    public static string? Validate(PushEventDto e)
    {
        if (e.Id is null || e.Id == Guid.Empty) return "Missing id.";
        if (e.Kind is null || !KindPattern().IsMatch(e.Kind)) return "Invalid kind.";
        if (e.ClientCreatedAt is null) return "Missing time.";
        if (e.Payload.ValueKind is JsonValueKind.Undefined) return "Missing payload.";
        if (e.Payload.GetRawText().Length > MaxPayloadBytes) return "Payload too large.";
        return null;
    }

    public static void MapSync(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/sync").RequireAuthorization();

        group.MapPost("/push", async (PushRequest request, ClaimsPrincipal principal, AppDbContext db, TimeProvider clock, CancellationToken ct) =>
        {
            var userId = UserIds.Get(principal);
            if (request.DeviceId is null || request.DeviceId == Guid.Empty || request.Events is null)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["request"] = ["deviceId and events are required."] });
            if (request.Events.Count > MaxBatch)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["events"] = [$"At most {MaxBatch} events per push."] });

            var platform = request.Platform is { Length: > 0 and <= 16 } p ? p : "web";

            // Register the device, or refresh it. A device id owned by another account is refused.
            var deviceOk = await DeviceRegistry.RegisterAsync(db, userId, request.DeviceId.Value, platform, ct);
            if (!deviceOk) return Results.Forbid();

            var accepted = new List<Guid>();
            var duplicates = new List<Guid>();
            var rejected = new List<RejectedDto>();

            foreach (var e in request.Events)
            {
                var problem = Validate(e);
                if (problem is not null)
                {
                    rejected.Add(new RejectedDto(e.Id ?? Guid.Empty, problem));
                    continue;
                }

                var payload = new NpgsqlParameter("payload", NpgsqlDbType.Jsonb) { Value = e.Payload.GetRawText() };
                var inserted = await db.Database.ExecuteSqlRawAsync(
                    """
                    INSERT INTO sync_events (id, user_id, device_id, kind, payload, client_created_at)
                    VALUES (@id, @user, @device, @kind, @payload, @created)
                    ON CONFLICT (user_id, id) DO NOTHING
                    """,
                    [
                        new NpgsqlParameter("id", e.Id!.Value),
                        new NpgsqlParameter("user", userId),
                        new NpgsqlParameter("device", request.DeviceId.Value),
                        new NpgsqlParameter("kind", e.Kind!),
                        payload,
                        new NpgsqlParameter("created", e.ClientCreatedAt!.Value.ToUniversalTime()),
                    ],
                    ct);

                (inserted == 1 ? accepted : duplicates).Add(e.Id.Value);
            }

            return Results.Ok(new PushResponse(accepted, duplicates, rejected));
        });

        group.MapGet("/pull", async (long? after, int? limit, ClaimsPrincipal principal, AppDbContext db, CancellationToken ct) =>
        {
            var userId = UserIds.Get(principal);
            var cursor = Math.Max(after ?? 0, 0);
            var take = Math.Clamp(limit ?? 200, 1, 500);

            var rows = await db.SyncEvents.AsNoTracking()
                .Where(x => x.UserId == userId && x.Seq > cursor)
                .OrderBy(x => x.Seq)
                .Take(take + 1)
                .ToListAsync(ct);

            var hasMore = rows.Count > take;
            var page = rows.Take(take).ToList();
            var events = page
                .Select(x => new PulledEventDto(x.Seq, x.Id, x.DeviceId, x.Kind, x.Payload.RootElement.Clone(), x.ClientCreatedAt, x.ReceivedAt))
                .ToList();

            return Results.Ok(new PullResponse(events, page.Count > 0 ? page[^1].Seq : cursor, hasMore));
        });
    }
}
