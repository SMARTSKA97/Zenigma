using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Zenigma.Api.Auth;

namespace Zenigma.Api.Tests;

/// <summary>A Google check that accepts tokens of the form "ok:subject:email:name".</summary>
public sealed class FakeGoogle : IGoogleTokenVerifier
{
    public Task<GoogleIdentity?> VerifyAsync(string idToken, CancellationToken ct)
    {
        var parts = idToken.Split(':');
        return Task.FromResult<GoogleIdentity?>(parts is ["ok", var sub, var email, var name] ? new GoogleIdentity(sub, email, true, name) : null);
    }
}

public class ProfileTests : IClassFixture<ApiFactory>
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private static readonly string ValidPassword = Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(12));
    private readonly ApiFactory _factory;

    public ProfileTests(ApiFactory factory) => _factory = factory;

    private record Session(string AccessToken, string RefreshToken, JsonElement User);

    private async Task<HttpClient> SignUpAsync(WebApplicationFactory<Program>? factory = null)
    {
        var client = (factory ?? _factory).CreateClient();
        var response = await client.PostAsJsonAsync("/auth/register", new { email = $"{Guid.NewGuid():N}@example.com", password = ValidPassword, displayName = "Tester", deviceId = Guid.NewGuid() });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var session = (await response.Content.ReadFromJsonAsync<Session>(Json))!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", session.AccessToken);
        return client;
    }

    private WebApplicationFactory<Program> WithGoogle() => _factory.WithWebHostBuilder(b =>
    {
        b.UseSetting("Google:ClientId", "test-client.apps.googleusercontent.com");
        b.ConfigureServices(s => s.AddSingleton<IGoogleTokenVerifier, FakeGoogle>());
    });

    [DbFact]
    public async Task Hints_two_devices_spending_the_last_hint_report_the_shortfall()
    {
        var client = await SignUpAsync();
        await client.PostAsJsonAsync("/hints/sync", new { entries = Array.Empty<object>(), localBalance = 1 });

        var first = new { id = Guid.NewGuid(), delta = -1, reason = "hint" };
        var second = new { id = Guid.NewGuid(), delta = -1, reason = "hint" }; // the other device spent the same hint
        var a = await (await client.PostAsJsonAsync("/hints/sync", new { entries = new[] { first }, localBalance = 1 })).Content.ReadFromJsonAsync<JsonElement>(Json);
        Assert.Equal(0, a.GetProperty("balance").GetInt32());
        Assert.Equal(0, a.GetProperty("short").GetInt32());

        var b = await (await client.PostAsJsonAsync("/hints/sync", new { entries = new[] { second }, localBalance = 1 })).Content.ReadFromJsonAsync<JsonElement>(Json);
        Assert.Equal(0, b.GetProperty("balance").GetInt32()); // never below zero
        Assert.Equal(1, b.GetProperty("short").GetInt32());
    }

    [DbFact]
    public async Task Hints_first_sync_adopts_the_device_balance_and_entries_apply_once()
    {
        var client = await SignUpAsync();
        var first = await (await client.PostAsJsonAsync("/hints/sync", new { entries = Array.Empty<object>(), localBalance = 7 })).Content.ReadFromJsonAsync<JsonElement>(Json);
        Assert.Equal(7, first.GetProperty("balance").GetInt32());

        var spend = new { id = Guid.NewGuid(), delta = -1, reason = "hint" };
        var one = await (await client.PostAsJsonAsync("/hints/sync", new { entries = new[] { spend }, localBalance = 7 })).Content.ReadFromJsonAsync<JsonElement>(Json);
        Assert.Equal(6, one.GetProperty("balance").GetInt32());

        // The same entry sent again (a retry) changes nothing.
        var again = await (await client.PostAsJsonAsync("/hints/sync", new { entries = new[] { spend }, localBalance = 6 })).Content.ReadFromJsonAsync<JsonElement>(Json);
        Assert.Equal(6, again.GetProperty("balance").GetInt32());

        // Earning is capped, and an invalid entry is ignored.
        var earns = Enumerable.Range(0, 3).Select(_ => new { id = Guid.NewGuid(), delta = 3, reason = "wheel" }).Append(new { id = Guid.NewGuid(), delta = 50, reason = "wheel" });
        var capped = await (await client.PostAsJsonAsync("/hints/sync", new { entries = earns, localBalance = 6 })).Content.ReadFromJsonAsync<JsonElement>(Json);
        Assert.Equal(10, capped.GetProperty("balance").GetInt32());

        var read = await client.GetFromJsonAsync<JsonElement>("/hints", Json);
        Assert.Equal(10, read.GetProperty("balance").GetInt32());
    }

    [DbFact]
    public async Task Profile_saves_details_and_rejects_unknown_ones()
    {
        var client = await SignUpAsync();
        var bad = await client.PutAsJsonAsync("/profile", new { ageGroup = "12-17" });
        Assert.Equal(HttpStatusCode.BadRequest, bad.StatusCode);

        var ok = await client.PutAsJsonAsync("/profile", new { displayName = "Ada", ageGroup = "25-34", gender = "female", shareCohort = true, hideName = true });
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        var profile = await client.GetFromJsonAsync<JsonElement>("/profile", Json);
        Assert.Equal("Ada", profile.GetProperty("displayName").GetString());
        Assert.Equal("25-34", profile.GetProperty("ageGroup").GetString());
        Assert.True(profile.GetProperty("shareCohort").GetBoolean());
        Assert.True(profile.GetProperty("hideName").GetBoolean());
        Assert.True(profile.GetProperty("hasPassword").GetBoolean());
    }

    [DbFact]
    public async Task Google_sign_in_creates_an_account_that_can_add_a_password_and_unlink()
    {
        var factory = WithGoogle();
        var client = factory.CreateClient();
        var email = $"{Guid.NewGuid():N}@example.com";
        var sub = Guid.NewGuid().ToString("N");

        var config = await client.GetFromJsonAsync<JsonElement>("/auth/config", Json);
        Assert.Equal("test-client.apps.googleusercontent.com", config.GetProperty("googleClientId").GetString());

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/auth/google", new { idToken = "nope" })).StatusCode);

        var login = await client.PostAsJsonAsync("/auth/google", new { idToken = $"ok:{sub}:{email}:Grace", deviceId = Guid.NewGuid() });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var session = (await login.Content.ReadFromJsonAsync<Session>(Json))!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", session.AccessToken);

        var profile = await client.GetFromJsonAsync<JsonElement>("/profile", Json);
        Assert.False(profile.GetProperty("hasPassword").GetBoolean());
        Assert.Contains("google", profile.GetProperty("providers").EnumerateArray().Select(p => p.GetString()));

        // Without a password, Google cannot be disconnected.
        Assert.Equal(HttpStatusCode.Conflict, (await client.DeleteAsync("/profile/providers/google")).StatusCode);

        var added = await client.PostAsJsonAsync("/profile/password", new { newPassword = ValidPassword });
        Assert.Equal(HttpStatusCode.NoContent, added.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync("/profile/providers/google")).StatusCode);

        // The email and the new password now sign in directly.
        var password = await client.PostAsJsonAsync("/auth/login", new { email, password = ValidPassword });
        Assert.Equal(HttpStatusCode.OK, password.StatusCode);
    }

    [DbFact]
    public async Task Google_claiming_an_unverified_password_account_removes_the_old_password()
    {
        var factory = WithGoogle();
        var client = factory.CreateClient();
        var email = $"{Guid.NewGuid():N}@example.com";

        // Someone signs up with an address (and a password) before the address's owner does.
        var signup = await client.PostAsJsonAsync("/auth/register", new { email, password = ValidPassword, deviceId = Guid.NewGuid() });
        Assert.Equal(HttpStatusCode.OK, signup.StatusCode);
        var attacker = (await signup.Content.ReadFromJsonAsync<Session>(Json))!;

        // The owner then signs in with Google for the same address.
        var google = await client.PostAsJsonAsync("/auth/google", new { idToken = $"ok:{Guid.NewGuid():N}:{email}:Owner", deviceId = Guid.NewGuid() });
        Assert.Equal(HttpStatusCode.OK, google.StatusCode);

        // The first person's password and session no longer work.
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/auth/login", new { email, password = ValidPassword })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/auth/refresh", new { refreshToken = attacker.RefreshToken })).StatusCode);
    }

    [DbFact]
    public async Task Changing_the_password_ends_the_other_sessions_but_not_this_one()
    {
        var client = _factory.CreateClient();
        var email = $"{Guid.NewGuid():N}@example.com";
        var first = (await (await client.PostAsJsonAsync("/auth/register", new { email, password = ValidPassword, deviceId = Guid.NewGuid() })).Content.ReadFromJsonAsync<Session>(Json))!;
        var second = (await (await client.PostAsJsonAsync("/auth/login", new { email, password = ValidPassword, deviceId = Guid.NewGuid() })).Content.ReadFromJsonAsync<Session>(Json))!;

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", first.AccessToken);
        var changed = await client.PostAsJsonAsync("/profile/password", new { currentPassword = ValidPassword, newPassword = ValidPassword + "x", refreshToken = first.RefreshToken });
        Assert.Equal(HttpStatusCode.NoContent, changed.StatusCode);

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/auth/refresh", new { refreshToken = second.RefreshToken })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/auth/refresh", new { refreshToken = first.RefreshToken })).StatusCode);
    }

    [DbFact]
    public async Task Mind_comparison_needs_enough_sharing_players()
    {
        var me = await SignUpAsync();
        Assert.Equal(HttpStatusCode.OK, (await me.PutAsJsonAsync("/profile", new { shareCohort = true, ageGroup = "25-34" })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await me.PutAsJsonAsync("/mind/scores", new { scores = new[] { new { game = "quick-sums", skill = "math", pct = 80, plays = 3 } } })).StatusCode);

        var early = await me.GetFromJsonAsync<JsonElement>("/mind/compare", Json);
        var everyone = early.GetProperty("groups")[0];
        Assert.False(everyone.GetProperty("ready").GetBoolean());

        for (var i = 0; i < 5; i++)
        {
            var other = await SignUpAsync();
            await other.PutAsJsonAsync("/profile", new { shareCohort = true });
            await other.PutAsJsonAsync("/mind/scores", new { scores = new[] { new { game = "quick-sums", skill = "math", pct = 40 + i * 5, plays = 1 } } });
        }

        var now = await me.GetFromJsonAsync<JsonElement>("/mind/compare", Json);
        var group = now.GetProperty("groups")[0];
        Assert.True(group.GetProperty("ready").GetBoolean());
        var maths = group.GetProperty("skills").EnumerateArray().First(s => s.GetProperty("skill").GetString() == "math");
        Assert.Equal(80, maths.GetProperty("mine").GetInt32());
        Assert.True(maths.GetProperty("percentile").GetInt32() >= 80);
    }
}
