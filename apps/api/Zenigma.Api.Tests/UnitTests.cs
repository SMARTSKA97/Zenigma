using Microsoft.Extensions.Configuration;
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

public class ConnectionTuningTests
{
    [Fact]
    public void Defaults_fill_the_gaps()
    {
        var result = ConnectionStrings.Tune("Host=db.example.com;Database=z;Username=u");
        Assert.Contains("Maximum Pool Size=20", result);
        Assert.Contains("Timeout=20", result);
        Assert.Contains("Command Timeout=20", result);
        Assert.DoesNotContain("No Reset On Close", result);
    }

    [Fact]
    public void Settings_already_present_are_kept()
    {
        var result = ConnectionStrings.Tune("Host=db.example.com;Database=z;Username=u;MaxPoolSize=5;Command Timeout=3");
        Assert.Contains("Maximum Pool Size=5", result);
        Assert.Contains("Command Timeout=3", result);
    }

    [Fact]
    public void The_neon_pooler_skips_the_session_reset()
    {
        var result = ConnectionStrings.Tune("Host=ep-cool-pooler.neon.tech;Database=z;Username=u");
        Assert.Contains("No Reset On Close", result);
    }
}

public class BoardCacheTests
{
    private static BoardCache Make(int seconds) => new(
        new Microsoft.Extensions.Configuration.ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Cache:BoardSeconds"] = seconds.ToString() }).Build(),
        TimeProvider.System);

    [Fact]
    public async Task Concurrent_requests_share_one_computation()
    {
        var cache = Make(30);
        var calls = 0;
        async Task<List<int>> Compute()
        {
            Interlocked.Increment(ref calls);
            await Task.Delay(50);
            return [1, 2, 3];
        }

        var results = await Task.WhenAll(Enumerable.Range(0, 20).Select(_ => cache.GetAsync("board", Compute)));
        Assert.Equal(1, calls);
        Assert.All(results, r => Assert.Equal(3, r.Count));
        await cache.GetAsync("board", Compute);
        Assert.Equal(1, calls);
    }

    [Fact]
    public async Task A_lifetime_of_zero_turns_the_cache_off()
    {
        var cache = Make(0);
        var calls = 0;
        Task<string> Compute() { calls++; return Task.FromResult("x"); }
        await cache.GetAsync("k", Compute);
        await cache.GetAsync("k", Compute);
        Assert.Equal(2, calls);
    }

    [Fact]
    public async Task A_failure_is_not_cached()
    {
        var cache = Make(30);
        var calls = 0;
        Task<string> Compute() { calls++; return calls == 1 ? throw new InvalidOperationException("boom") : Task.FromResult("ok"); }
        await Assert.ThrowsAsync<InvalidOperationException>(() => cache.GetAsync("k", Compute));
        Assert.Equal("ok", await cache.GetAsync("k", Compute));
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

public class DotEnvTests
{
    [Theory]
    [InlineData("KEY=value", "KEY", "value")]
    [InlineData("  KEY = value  ", "KEY", "value")]
    [InlineData("export KEY=value", "KEY", "value")]
    [InlineData("KEY=\"quoted value\"", "KEY", "quoted value")]
    [InlineData("KEY='single'", "KEY", "single")]
    [InlineData("KEY=value # trailing comment", "KEY", "value")]
    [InlineData("Host=a;Password=x=y", "Host", "a;Password=x=y")]
    public void Parses_assignments(string line, string key, string value)
    {
        Assert.Equal((key, value), Zenigma.Api.Infrastructure.DotEnv.Parse(line));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("# comment")]
    [InlineData("NOEQUALS")]
    [InlineData("BLANK=")]
    [InlineData("=value")]
    public void Skips_comments_blanks_and_placeholders(string line)
    {
        Assert.Null(Zenigma.Api.Infrastructure.DotEnv.Parse(line));
    }
}
