using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Zenigma.Api.Data;

/// <summary>
/// Maps the tables created by the Flyway migrations in /db/migrations. The API never creates or alters schema.
/// </summary>
public class AppDbContext(DbContextOptions<AppDbContext> options) : IdentityDbContext<ApplicationUser>(options)
{
    public DbSet<Device> Devices => Set<Device>();
    public DbSet<SyncEvent> SyncEvents => Set<SyncEvent>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<DailyPuzzle> DailyPuzzles => Set<DailyPuzzle>();
    public DbSet<DailyAttempt> DailyAttempts => Set<DailyAttempt>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);

        b.Entity<ApplicationUser>().Property(u => u.DisplayName).HasMaxLength(64);

        b.Entity<Device>(e =>
        {
            e.ToTable("devices");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.UserId).HasColumnName("user_id");
            e.Property(x => x.Platform).HasColumnName("platform").HasMaxLength(16);
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.Property(x => x.LastSeenAt).HasColumnName("last_seen_at");
        });

        b.Entity<SyncEvent>(e =>
        {
            e.ToTable("sync_events");
            e.HasKey(x => x.Seq);
            e.Property(x => x.Seq).HasColumnName("seq").ValueGeneratedOnAdd();
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.UserId).HasColumnName("user_id");
            e.Property(x => x.DeviceId).HasColumnName("device_id");
            e.Property(x => x.Kind).HasColumnName("kind").HasMaxLength(64);
            e.Property(x => x.Payload).HasColumnName("payload").HasColumnType("jsonb");
            e.Property(x => x.ClientCreatedAt).HasColumnName("client_created_at");
            e.Property(x => x.ReceivedAt).HasColumnName("received_at");
        });

        b.Entity<RefreshToken>(e =>
        {
            e.ToTable("refresh_tokens");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.UserId).HasColumnName("user_id");
            e.Property(x => x.DeviceId).HasColumnName("device_id");
            e.Property(x => x.TokenHash).HasColumnName("token_hash");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.Property(x => x.ExpiresAt).HasColumnName("expires_at");
            e.Property(x => x.RevokedAt).HasColumnName("revoked_at");
            e.Property(x => x.ReplacedBy).HasColumnName("replaced_by");
        });

        b.Entity<DailyPuzzle>(e =>
        {
            e.ToTable("daily_puzzles");
            e.HasKey(x => new { x.Game, x.PuzzleDate });
            e.Property(x => x.Game).HasColumnName("game").HasMaxLength(32);
            e.Property(x => x.PuzzleDate).HasColumnName("puzzle_date");
            e.Property(x => x.Puzzle).HasColumnName("puzzle").HasColumnType("jsonb");
        });

        b.Entity<DailyAttempt>(e =>
        {
            e.ToTable("daily_attempts");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.UserId).HasColumnName("user_id");
            e.Property(x => x.Game).HasColumnName("game").HasMaxLength(32);
            e.Property(x => x.PuzzleDate).HasColumnName("puzzle_date");
            e.Property(x => x.DeviceId).HasColumnName("device_id");
            e.Property(x => x.Hard).HasColumnName("hard");
            e.Property(x => x.Status).HasColumnName("status").HasMaxLength(16);
            e.Property(x => x.Guesses).HasColumnName("guesses").HasColumnType("text[]");
            e.Property(x => x.StartedAt).HasColumnName("started_at");
            e.Property(x => x.FirstGuessAt).HasColumnName("first_guess_at");
            e.Property(x => x.LastActiveAt).HasColumnName("last_active_at");
            e.Property(x => x.FinishedAt).HasColumnName("finished_at");
        });
    }
}
