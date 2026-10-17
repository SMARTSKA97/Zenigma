using Microsoft.EntityFrameworkCore;
using Zenigma.Api.Data;

namespace Zenigma.Api.Infrastructure;

/// <summary>
/// Keeps the event log from growing for ever. Only events whose value is spent are removed: the daily mind-training
/// results are read by the board for the current day and week, so anything older than <c>Retention:MindDays</c> (default 180,
/// 0 turns this off) is deleted, a few thousand at a time. Everything that restores a player's progress on a new device
/// (solved levels, finished words) is never touched.
/// </summary>
public sealed class SyncEventRetention(IServiceScopeFactory scopes, IConfiguration config, TimeProvider clock, ILogger<SyncEventRetention> log) : BackgroundService
{
    private const int Batch = 5000;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var days = config.GetValue("Retention:MindDays", 180);
        if (days <= 0) return;
        try
        {
            await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
            using var timer = new PeriodicTimer(TimeSpan.FromHours(6));
            do
            {
                try
                {
                    await using var scope = scopes.CreateAsyncScope();
                    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    var cutoff = clock.GetUtcNow().AddDays(-days);
                    int removed, total = 0;
                    do
                    {
                        removed = await db.Database.ExecuteSqlInterpolatedAsync($"""
                            DELETE FROM sync_events WHERE seq IN (
                                SELECT seq FROM sync_events
                                WHERE kind = 'mind.daily.completed' AND received_at < {cutoff}
                                LIMIT {Batch})
                            """, stoppingToken);
                        total += removed;
                    } while (removed == Batch);
                    if (total > 0) log.LogInformation("Removed {Count} old mind-training events", total);
                }
                catch (Exception e) when (e is not OperationCanceledException)
                {
                    log.LogWarning(e, "Event retention failed; it will try again in six hours");
                }
            } while (await timer.WaitForNextTickAsync(stoppingToken));
        }
        catch (OperationCanceledException)
        {
            // Shutting down.
        }
    }
}
