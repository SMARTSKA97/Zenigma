using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Zenigma.Api.Tests;

/// <summary>Runs only when ZENIGMA_TEST_DB points at a Postgres database that Flyway has migrated (CI does this).</summary>
public sealed class DbFactAttribute : FactAttribute
{
    public DbFactAttribute()
    {
        if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable("ZENIGMA_TEST_DB")))
            Skip = "ZENIGMA_TEST_DB is not set.";
    }
}

public class ApiFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(Microsoft.AspNetCore.Hosting.IWebHostBuilder builder)
    {
        builder.UseSetting("ConnectionStrings:Default", Environment.GetEnvironmentVariable("ZENIGMA_TEST_DB") ?? "Host=unused");
        builder.UseSetting("Jwt:Key", "test-signing-key-test-signing-key-123456");
    }
}

public class ApiTests : IClassFixture<ApiFactory>
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private readonly ApiFactory _factory;

    public ApiTests(ApiFactory factory) => _factory = factory;

    private record Session(string AccessToken, string RefreshToken, JsonElement User);

    private async Task<(HttpClient client, Session session, Guid device)> SignUpAsync()
    {
        var client = _factory.CreateClient();
        var device = Guid.NewGuid();
        var response = await client.PostAsJsonAsync("/auth/register", new
        {
            email = $"{Guid.NewGuid():N}@example.com",
            password = "correct-horse-battery",
            displayName = "Tester",
            deviceId = device,
        });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var session = (await response.Content.ReadFromJsonAsync<Session>(Json))!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", session.AccessToken);
        return (client, session, device);
    }

    private static object Event(Guid? id = null, string kind = "note.added") =>
        new { id = id ?? Guid.NewGuid(), kind, payload = new { text = "hi" }, clientCreatedAt = DateTimeOffset.UtcNow };

    [DbFact]
    public async Task Health_and_time_are_public()
    {
        var client = _factory.CreateClient();
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health")).StatusCode);
        var time = await client.GetFromJsonAsync<JsonElement>("/time", Json);
        Assert.Matches(@"^\d{4}-\d{2}-\d{2}$", time.GetProperty("istDate").GetString());
    }

    [DbFact]
    public async Task Register_rejects_weak_password_and_duplicate_email()
    {
        var client = _factory.CreateClient();
        var email = $"{Guid.NewGuid():N}@example.com";
        var weak = await client.PostAsJsonAsync("/auth/register", new { email, password = "short" });
        Assert.Equal(HttpStatusCode.BadRequest, weak.StatusCode);

        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/auth/register", new { email, password = "long-enough-1" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/auth/register", new { email, password = "long-enough-1" })).StatusCode);
    }

    [DbFact]
    public async Task Login_works_and_wrong_password_is_401()
    {
        var client = _factory.CreateClient();
        var email = $"{Guid.NewGuid():N}@example.com";
        await client.PostAsJsonAsync("/auth/register", new { email, password = "long-enough-1" });

        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/auth/login", new { email, password = "long-enough-1" })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/auth/login", new { email, password = "wrong-password" })).StatusCode);
    }

    [DbFact]
    public async Task Refresh_rotates_the_token_and_old_one_stops_working()
    {
        var (client, session, device) = await SignUpAsync();

        var first = await client.PostAsJsonAsync("/auth/refresh", new { refreshToken = session.RefreshToken, deviceId = device });
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        var renewed = (await first.Content.ReadFromJsonAsync<Session>(Json))!;
        Assert.NotEqual(session.RefreshToken, renewed.RefreshToken);

        var reuse = await client.PostAsJsonAsync("/auth/refresh", new { refreshToken = session.RefreshToken, deviceId = device });
        Assert.Equal(HttpStatusCode.Unauthorized, reuse.StatusCode);

        await client.PostAsJsonAsync("/auth/logout", new { refreshToken = renewed.RefreshToken });
        var afterLogout = await client.PostAsJsonAsync("/auth/refresh", new { refreshToken = renewed.RefreshToken, deviceId = device });
        Assert.Equal(HttpStatusCode.Unauthorized, afterLogout.StatusCode);
    }

    [DbFact]
    public async Task Sync_requires_a_token()
    {
        var client = _factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/sync/pull")).StatusCode);
    }

    [DbFact]
    public async Task Push_is_idempotent_and_pull_pages_by_cursor()
    {
        var (client, _, device) = await SignUpAsync();
        var id = Guid.NewGuid();

        var push = await client.PostAsJsonAsync("/sync/push", new { deviceId = device, platform = "web", events = new[] { Event(id), Event() } });
        var body = await push.Content.ReadFromJsonAsync<JsonElement>(Json);
        Assert.Equal(2, body.GetProperty("accepted").GetArrayLength());

        var again = await (await client.PostAsJsonAsync("/sync/push", new { deviceId = device, platform = "web", events = new[] { Event(id) } }))
            .Content.ReadFromJsonAsync<JsonElement>(Json);
        Assert.Equal(0, again.GetProperty("accepted").GetArrayLength());
        Assert.Equal(1, again.GetProperty("duplicates").GetArrayLength());

        var page1 = await client.GetFromJsonAsync<JsonElement>("/sync/pull?after=0&limit=1", Json);
        Assert.Equal(1, page1.GetProperty("events").GetArrayLength());
        Assert.True(page1.GetProperty("hasMore").GetBoolean());

        var page2 = await client.GetFromJsonAsync<JsonElement>($"/sync/pull?after={page1.GetProperty("nextCursor").GetInt64()}&limit=10", Json);
        Assert.Equal(1, page2.GetProperty("events").GetArrayLength());
        Assert.False(page2.GetProperty("hasMore").GetBoolean());
    }

    [DbFact]
    public async Task Bad_events_are_rejected_without_blocking_good_ones()
    {
        var (client, _, device) = await SignUpAsync();
        var push = await client.PostAsJsonAsync("/sync/push", new
        {
            deviceId = device,
            platform = "web",
            events = new[] { Event(kind: "Bad Kind"), Event() },
        });
        var body = await push.Content.ReadFromJsonAsync<JsonElement>(Json);
        Assert.Equal(1, body.GetProperty("accepted").GetArrayLength());
        Assert.Equal(1, body.GetProperty("rejected").GetArrayLength());
    }

    [DbFact]
    public async Task Users_cannot_see_each_others_events_or_use_each_others_devices()
    {
        var (alice, _, aliceDevice) = await SignUpAsync();
        var (bob, _, _) = await SignUpAsync();
        await alice.PostAsJsonAsync("/sync/push", new { deviceId = aliceDevice, platform = "web", events = new[] { Event() } });

        var bobPull = await bob.GetFromJsonAsync<JsonElement>("/sync/pull?after=0", Json);
        Assert.Equal(0, bobPull.GetProperty("events").GetArrayLength());

        var stolen = await bob.PostAsJsonAsync("/sync/push", new { deviceId = aliceDevice, platform = "web", events = new[] { Event() } });
        Assert.Equal(HttpStatusCode.Forbidden, stolen.StatusCode);
    }
}
