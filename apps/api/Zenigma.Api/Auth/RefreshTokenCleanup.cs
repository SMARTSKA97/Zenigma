using Microsoft.EntityFrameworkCore;
using Zenigma.Api.Data;

namespace Zenigma.Api.Auth;

/// <summary>
/// Housekeeping: refresh tokens that expired, or were revoked, more than a week ago are deleted once an hour,
/// so the table (and the stolen-token check, which needs the recent ones) stays small.
/// </summary>
public sealed class RefreshTokenCleanup(IServiceScopeFactory scopes, TimeProvider clock, ILogger<RefreshTokenCleanup> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            // Wait first, so a start-up (or a test) never touches the database straight away.
            await Task.Delay(TimeSpan.FromMinutes(3), stoppingToken);
            using var timer = new PeriodicTimer(TimeSpan.FromHours(1));
            do
            {
                try
                {
                    await using var scope = scopes.CreateAsyncScope();
                    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    var cutoff = clock.GetUtcNow().AddDays(-7);
                    var removed = await db.RefreshTokens
                        .Where(t => t.ExpiresAt < cutoff || (t.RevokedAt != null && t.RevokedAt < cutoff))
                        .ExecuteDeleteAsync(stoppingToken);
                    if (removed > 0) log.LogInformation("Removed {Count} old refresh tokens", removed);
                    var mailCutoff = clock.GetUtcNow().AddDays(-1);
                    await db.EmailCodes.Where(x => x.CreatedAt < mailCutoff).ExecuteDeleteAsync(stoppingToken);
                }
                catch (Exception e) when (e is not OperationCanceledException)
                {
                    log.LogWarning(e, "Refresh token cleanup failed; it will try again in an hour");
                }
            } while (await timer.WaitForNextTickAsync(stoppingToken));
        }
        catch (OperationCanceledException)
        {
            // Shutting down.
        }
    }
}
