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
