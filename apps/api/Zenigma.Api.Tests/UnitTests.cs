using System.Text.Json;
using Zenigma.Api.Auth;
using Zenigma.Api.Infrastructure;
using Zenigma.Api.Sync;

namespace Zenigma.Api.Tests;

public class ConnectionStringTests
{
    [Fact]
    public void Npgsql_strings_pass_through()
    {
        const string s = "Host=localhost;Database=zenigma;Username=u";
        Assert.Equal(s, ConnectionStrings.Normalize(s));
    }

    [Fact]
    public void Uri_form_is_converted_with_ssl_required()
    {
        var result = ConnectionStrings.Normalize("postgresql://app:pw%40x@ep-cool.neon.tech/zenigma?sslmode=require");
        Assert.Contains("Host=ep-cool.neon.tech", result);
        Assert.Contains("Database=zenigma", result);
        Assert.Contains("Username=app", result);
        Assert.Contains("Password=pw@x", result);
        Assert.Contains("SSL Mode=Require", result);
    }
}

public class IstClockTests
{
    [Fact]
    public void Day_rolls_over_at_midnight_ist()
    {
        // 18:29 UTC is 23:59 IST; one minute later it is the next IST day.
        Assert.Equal(new DateOnly(2026, 10, 8), IstClock.Today(new DateTimeOffset(2026, 10, 8, 18, 29, 0, TimeSpan.Zero)));
        Assert.Equal(new DateOnly(2026, 10, 9), IstClock.Today(new DateTimeOffset(2026, 10, 8, 18, 30, 0, TimeSpan.Zero)));
    }

    [Fact]
    public void Next_rollover_is_the_coming_midnight_ist()
    {
        var next = IstClock.NextRollover(new DateTimeOffset(2026, 10, 8, 10, 0, 0, TimeSpan.Zero));
        Assert.Equal(new DateTimeOffset(2026, 10, 8, 18, 30, 0, TimeSpan.Zero), next.ToUniversalTime());
    }
}

public class TokenHashTests
{
    [Fact]
    public void Hash_is_stable_and_not_the_token()
    {
        var token = TokenService.NewRefreshToken();
        Assert.Equal(TokenService.Hash(token), TokenService.Hash(token));
        Assert.NotEqual(token, TokenService.Hash(token));
        Assert.NotEqual(TokenService.NewRefreshToken(), token);
    }
}

public class PushValidationTests
{
    private static PushEventDto Make(Guid? id = null, string? kind = "note", string payload = "{}") =>
        new(id ?? Guid.NewGuid(), kind, JsonDocument.Parse(payload).RootElement, DateTimeOffset.UtcNow);

    [Fact]
    public void Valid_event_passes() => Assert.Null(SyncEndpoints.Validate(Make()));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("Has Spaces")]
    [InlineData("UPPER")]
    public void Bad_kinds_are_rejected(string? kind) => Assert.NotNull(SyncEndpoints.Validate(Make(kind: kind)));

    [Fact]
    public void Empty_id_is_rejected() => Assert.NotNull(SyncEndpoints.Validate(Make(Guid.Empty)));

    [Fact]
    public void Oversized_payload_is_rejected()
    {
        var big = "{\"x\":\"" + new string('a', SyncEndpoints.MaxPayloadBytes) + "\"}";
        Assert.NotNull(SyncEndpoints.Validate(Make(payload: big)));
    }
}
