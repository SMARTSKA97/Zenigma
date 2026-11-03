using Zenigma.Api.Infrastructure;

namespace Zenigma.Api.Auth;

public static class DeviceEndpoints
{
    public static void MapDevices(this WebApplication app)
    {
        var group = app.MapGroup("/auth/devices").RequireAuthorization();

        // The devices signed in now and how many this account may have. `current` is the caller's own device id, to mark it.
        group.MapGet("", async (Guid? current, System.Security.Claims.ClaimsPrincipal principal, DeviceService devices, CancellationToken ct) =>
        {
            var userId = UserIds.Get(principal);
            return Results.Ok(new { limit = await devices.LimitAsync(userId, ct), devices = await devices.ActiveAsync(userId, current, ct) });
        });

        group.MapPost("{id:guid}/signout", async (Guid id, System.Security.Claims.ClaimsPrincipal principal, DeviceService devices, CancellationToken ct) =>
        {
            await devices.SignOutAsync(UserIds.Get(principal), id, ct);
            return Results.NoContent();
        });

        // Signs out every device, or every device but `keep` (the one the player is holding).
        group.MapPost("signout-all", async (Guid? keep, System.Security.Claims.ClaimsPrincipal principal, DeviceService devices, CancellationToken ct) =>
        {
            await devices.SignOutAllAsync(UserIds.Get(principal), keep, ct);
            return Results.NoContent();
        });
    }
}
