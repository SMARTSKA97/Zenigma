using System.Text.Json;
using Microsoft.AspNetCore.Identity;

namespace Zenigma.Api.Data;

public class ApplicationUser : IdentityUser
{
    public string? DisplayName { get; set; }
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
