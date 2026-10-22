using System.Text.Json;
using Microsoft.AspNetCore.Identity;

namespace Zenigma.Api.Data;

public class ApplicationUser : IdentityUser
{
    public string? DisplayName { get; set; }

    /// <summary>When true, boards and circles show "Player XXXX" instead of the display name.</summary>
    public bool HideName { get; set; }
}

public class Device
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = "";
    public string Platform { get; set; } = "web";
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset LastSeenAt { get; set; }
}

public class SyncEvent
{
    public long Seq { get; set; }
    public Guid Id { get; set; }
    public string UserId { get; set; } = "";
    public Guid DeviceId { get; set; }
    public string Kind { get; set; } = "";
    public JsonDocument Payload { get; set; } = null!;
    public DateTimeOffset ClientCreatedAt { get; set; }
    public DateTimeOffset ReceivedAt { get; set; }
}

public class RefreshToken
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = "";
    public Guid? DeviceId { get; set; }
    public string TokenHash { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
    public Guid? ReplacedBy { get; set; }
}

public class EmailCode
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = "";
    public string Purpose { get; set; } = "";
    public string CodeHash { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public int Attempts { get; set; }
    public DateTimeOffset? UsedAt { get; set; }
}

public class DailyPuzzle
{
    public string Game { get; set; } = "";
    public DateOnly PuzzleDate { get; set; }
    public JsonDocument Puzzle { get; set; } = null!;
}

public class DailyAttempt
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = "";
    public string Game { get; set; } = "";
    public DateOnly PuzzleDate { get; set; }
    public Guid DeviceId { get; set; }
    public bool Hard { get; set; }
    public string Status { get; set; } = "playing";
    public List<string> Guesses { get; set; } = [];
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset? FirstGuessAt { get; set; }
    public DateTimeOffset LastActiveAt { get; set; }
    public DateTimeOffset? FinishedAt { get; set; }
    public int Hints { get; set; }
}

public class PuzzleAttempt
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = "";
    public string Game { get; set; } = "";
    public DateOnly PuzzleDate { get; set; }
    public Guid DeviceId { get; set; }
    public string Status { get; set; } = "playing";
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset LastActiveAt { get; set; }
    public DateTimeOffset? FinishedAt { get; set; }
    public int? ElapsedMs { get; set; }
    public int Hints { get; set; }
}

public class StreakFreeze
{
    public string UserId { get; set; } = "";
    public string Game { get; set; } = "";
    public DateOnly CoveredDate { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public class UserReward
{
    public string UserId { get; set; } = "";
    public int Freezes { get; set; }
    public DateOnly? LastAwardWeek { get; set; }
}

/// <summary>Freezes held for one game, and how many sets of seven played days have already earned one.</summary>
public class GameFreeze
{
    public string UserId { get; set; } = "";
    public string Game { get; set; } = "";
    public int Freezes { get; set; }
    public int CreditedBlocks { get; set; }
}

public class UserProfile
{
    public string UserId { get; set; } = "";
    public string? AgeGroup { get; set; }
    public string? Gender { get; set; }
    public bool ShareCohort { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public class HintBalance
{
    public string UserId { get; set; } = "";
    public int Balance { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public class CoinBalance
{
    public string UserId { get; set; } = "";
    public int Balance { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public class OwnedItem
{
    public string UserId { get; set; } = "";
    public string Item { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; }
}

public class MindScore
{
    public string UserId { get; set; } = "";
    public string Game { get; set; } = "";
    public string Skill { get; set; } = "";
    public int Pct { get; set; }
    public int Plays { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public class SupporterContribution
{
    public Guid Id { get; set; }
    public string? UserId { get; set; }
    public string Name { get; set; } = "";
    public int AmountInr { get; set; }
    public string Source { get; set; } = "manual";
    public bool ShowAmount { get; set; } = true;
    public string? ExternalId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
