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
    public DbSet<EmailCode> EmailCodes => Set<EmailCode>();
    public DbSet<DailyPuzzle> DailyPuzzles => Set<DailyPuzzle>();
    public DbSet<DailyAttempt> DailyAttempts => Set<DailyAttempt>();
    public DbSet<PuzzleAttempt> PuzzleAttempts => Set<PuzzleAttempt>();
    public DbSet<StreakFreeze> StreakFreezes => Set<StreakFreeze>();
    public DbSet<UserReward> UserRewards => Set<UserReward>();
    public DbSet<GameFreeze> GameFreezes => Set<GameFreeze>();
    public DbSet<UserProfile> UserProfiles => Set<UserProfile>();
    public DbSet<HintBalance> HintBalances => Set<HintBalance>();
    public DbSet<MindScore> MindScores => Set<MindScore>();
    public DbSet<CoinBalance> CoinBalances => Set<CoinBalance>();
    public DbSet<OwnedItem> OwnedItems => Set<OwnedItem>();

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

        b.Entity<EmailCode>(e =>
        {
            e.ToTable("email_codes");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.UserId).HasColumnName("user_id");
            e.Property(x => x.Purpose).HasColumnName("purpose").HasMaxLength(12);
            e.Property(x => x.CodeHash).HasColumnName("code_hash");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.Property(x => x.ExpiresAt).HasColumnName("expires_at");
            e.Property(x => x.Attempts).HasColumnName("attempts");
            e.Property(x => x.UsedAt).HasColumnName("used_at");
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
            e.Property(x => x.Hints).HasColumnName("hints");
            e.Property(x => x.StartedAt).HasColumnName("started_at");
            e.Property(x => x.FirstGuessAt).HasColumnName("first_guess_at");
            e.Property(x => x.LastActiveAt).HasColumnName("last_active_at");
            e.Property(x => x.FinishedAt).HasColumnName("finished_at");
        });

        b.Entity<PuzzleAttempt>(e =>
        {
            e.ToTable("puzzle_attempts");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.UserId).HasColumnName("user_id");
            e.Property(x => x.Game).HasColumnName("game").HasMaxLength(32);
            e.Property(x => x.PuzzleDate).HasColumnName("puzzle_date");
            e.Property(x => x.DeviceId).HasColumnName("device_id");
            e.Property(x => x.Status).HasColumnName("status").HasMaxLength(16);
            e.Property(x => x.StartedAt).HasColumnName("started_at");
            e.Property(x => x.LastActiveAt).HasColumnName("last_active_at");
            e.Property(x => x.FinishedAt).HasColumnName("finished_at");
            e.Property(x => x.ElapsedMs).HasColumnName("elapsed_ms");
            e.Property(x => x.Hints).HasColumnName("hints");
        });

        b.Entity<StreakFreeze>(e =>
        {
            e.ToTable("streak_freezes");
            e.HasKey(x => new { x.UserId, x.Game, x.CoveredDate });
            e.Property(x => x.UserId).HasColumnName("user_id");
            e.Property(x => x.Game).HasColumnName("game").HasMaxLength(32);
            e.Property(x => x.CoveredDate).HasColumnName("covered_date");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
        });

        b.Entity<GameFreeze>(e =>
        {
            e.ToTable("game_freezes");
            e.HasKey(x => new { x.UserId, x.Game });
            e.Property(x => x.UserId).HasColumnName("user_id");
            e.Property(x => x.Game).HasColumnName("game").HasMaxLength(32);
            e.Property(x => x.Freezes).HasColumnName("freezes");
            e.Property(x => x.CreditedBlocks).HasColumnName("credited_blocks");
        });

        b.Entity<UserReward>(e =>
        {
            e.ToTable("user_rewards");
            e.HasKey(x => x.UserId);
            e.Property(x => x.UserId).HasColumnName("user_id");
            e.Property(x => x.Freezes).HasColumnName("freezes");
            e.Property(x => x.LastAwardWeek).HasColumnName("last_award_week");
        });

        b.Entity<UserProfile>(e =>
        {
            e.ToTable("user_profiles");
            e.HasKey(x => x.UserId);
            e.Property(x => x.UserId).HasColumnName("user_id");
            e.Property(x => x.AgeGroup).HasColumnName("age_group").HasMaxLength(8);
            e.Property(x => x.Gender).HasColumnName("gender").HasMaxLength(12);
            e.Property(x => x.ShareCohort).HasColumnName("share_cohort");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        });

        b.Entity<HintBalance>(e =>
        {
            e.ToTable("hint_balances");
            e.HasKey(x => x.UserId);
            e.Property(x => x.UserId).HasColumnName("user_id");
            e.Property(x => x.Balance).HasColumnName("balance");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        });

        b.Entity<CoinBalance>(e =>
        {
            e.ToTable("coin_balances");
            e.HasKey(x => x.UserId);
            e.Property(x => x.UserId).HasColumnName("user_id");
            e.Property(x => x.Balance).HasColumnName("balance");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        });

        b.Entity<OwnedItem>(e =>
        {
            e.ToTable("owned_items");
            e.HasKey(x => new { x.UserId, x.Item });
            e.Property(x => x.UserId).HasColumnName("user_id");
            e.Property(x => x.Item).HasColumnName("item").HasMaxLength(32);
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
        });

        b.Entity<MindScore>(e =>
        {
            e.ToTable("mind_scores");
            e.HasKey(x => new { x.UserId, x.Game });
            e.Property(x => x.UserId).HasColumnName("user_id");
            e.Property(x => x.Game).HasColumnName("game").HasMaxLength(32);
            e.Property(x => x.Skill).HasColumnName("skill").HasMaxLength(16);
            e.Property(x => x.Pct).HasColumnName("pct");
            e.Property(x => x.Plays).HasColumnName("plays");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        });
    }
}
