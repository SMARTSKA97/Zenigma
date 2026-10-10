using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore;
using Zenigma.Api.Data;
using Zenigma.Api.Infrastructure;

namespace Zenigma.Api.Tests;

public class DailyFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(Microsoft.AspNetCore.Hosting.IWebHostBuilder builder)
    {
        builder.UseSetting("ConnectionStrings:Default", Environment.GetEnvironmentVariable("ZENIGMA_TEST_DB") ?? "Host=unused");
        builder.UseSetting("Jwt:Key", Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(48)));
        builder.UseSetting("Daily:LeaseSeconds", "1"); // short lease so takeover can be tested quickly
    }
}

public class DailyTests : IClassFixture<DailyFactory>
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private static readonly string Password = Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(12));
    private readonly DailyFactory _factory;

    public DailyTests(DailyFactory factory) => _factory = factory;

    /// <summary>Makes today's puzzle 'crane' (the IST date, exactly as the API computes it).</summary>
    private async Task SeedTodayAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var today = IstClock.Today(DateTimeOffset.UtcNow);
        await db.Database.ExecuteSqlInterpolatedAsync(
            $"INSERT INTO daily_puzzles (game, puzzle_date, puzzle) VALUES ('word-guess', {today}, '{{\"answer\":\"crane\"}}'::jsonb) ON CONFLICT (game, puzzle_date) DO UPDATE SET puzzle = EXCLUDED.puzzle");
    }

    private async Task<(HttpClient client, Guid device)> SignUpAsync()
    {
        var client = _factory.CreateClient();
        var device = Guid.NewGuid();
        var response = await client.PostAsJsonAsync("/auth/register", new { email = $"{Guid.NewGuid():N}@example.com", password = Password, deviceId = device });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(Json);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body.GetProperty("accessToken").GetString());
        return (client, device);
    }

    private static Task<HttpResponseMessage> Start(HttpClient c, Guid device, bool hard = false) =>
        c.PostAsJsonAsync("/daily/word-guess/start", new { deviceId = device, hard });

    private static Task<HttpResponseMessage> Guess(HttpClient c, Guid device, string word) =>
        c.PostAsJsonAsync("/daily/word-guess/guess", new { deviceId = device, word });

    [DbFact]
    public async Task Requires_sign_in()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await _factory.CreateClient().GetAsync("/daily/word-guess")).StatusCode);
    }

    [DbFact]
    public async Task Plays_a_full_game_and_never_reveals_the_answer_early()
    {
        await SeedTodayAsync();
        var (client, device) = await SignUpAsync();
        Assert.Equal(HttpStatusCode.OK, (await Start(client, device)).StatusCode);

        var first = await (await Guess(client, device, "slate")).Content.ReadFromJsonAsync<JsonElement>(Json);
        Assert.Equal("aacac", first.GetProperty("guess").GetProperty("marks").GetString());
        Assert.Equal("playing", first.GetProperty("status").GetString());
        Assert.Equal(JsonValueKind.Null, first.GetProperty("answer").ValueKind);

        var state = await client.GetFromJsonAsync<JsonElement>($"/daily/word-guess?deviceId={device}", Json);
        Assert.Equal(JsonValueKind.Null, state.GetProperty("attempt").GetProperty("answer").ValueKind);
        Assert.Equal(1, state.GetProperty("attempt").GetProperty("guesses").GetArrayLength());

        var won = await (await Guess(client, device, "crane")).Content.ReadFromJsonAsync<JsonElement>(Json);
        Assert.Equal("won", won.GetProperty("status").GetString());
        Assert.Equal("crane", won.GetProperty("answer").GetString());

        // The finished result is in the sync log for every device.
        var pulled = await client.GetFromJsonAsync<JsonElement>("/sync/pull?after=0", Json);
        Assert.Contains(pulled.GetProperty("events").EnumerateArray(), e => e.GetProperty("kind").GetString() == "wordguess.daily");

        // Single use: no more guesses and no restart.
        Assert.Equal(HttpStatusCode.Conflict, (await Guess(client, device, "slate")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Start(client, device)).StatusCode);
    }

    [DbFact]
    public async Task Bad_words_do_not_use_up_a_try()
    {
        await SeedTodayAsync();
        var (client, device) = await SignUpAsync();
        await Start(client, device);

        Assert.Equal(HttpStatusCode.UnprocessableEntity, (await Guess(client, device, "zzzzz")).StatusCode);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, (await Guess(client, device, "cat")).StatusCode);

        var state = await client.GetFromJsonAsync<JsonElement>($"/daily/word-guess?deviceId={device}", Json);
        Assert.Equal(0, state.GetProperty("attempt").GetProperty("guesses").GetArrayLength());
    }

    [DbFact]
    public async Task Loses_after_six_wrong_guesses_and_then_reveals_the_answer()
    {
        await SeedTodayAsync();
        var (client, device) = await SignUpAsync();
        await Start(client, device);

        JsonElement last = default;
        foreach (var word in new[] { "slate", "pious", "dumpy", "ghost", "fishy", "bluff" })
        {
            last = await (await Guess(client, device, word)).Content.ReadFromJsonAsync<JsonElement>(Json);
        }

        Assert.Equal("lost", last.GetProperty("status").GetString());
        Assert.Equal("crane", last.GetProperty("answer").GetString());
    }

    [DbFact]
    public async Task Hard_mode_is_enforced_by_the_server()
    {
        await SeedTodayAsync();
        var (client, device) = await SignUpAsync();
        await Start(client, device, hard: true);

        await Guess(client, device, "slate"); // reveals a (green, position 3) and e (green, position 5)
        var illegal = await Guess(client, device, "about"); // moves the green a
        Assert.Equal(HttpStatusCode.UnprocessableEntity, illegal.StatusCode);
        var body = await illegal.Content.ReadFromJsonAsync<JsonElement>(Json);
        Assert.Equal("hard-mode", body.GetProperty("error").GetString());

        Assert.Equal(HttpStatusCode.OK, (await Guess(client, device, "trace")).StatusCode);
    }

    [DbFact]
    public async Task Only_one_device_plays_at_a_time_and_an_idle_one_can_be_taken_over()
    {
        await SeedTodayAsync();
        var (client, first) = await SignUpAsync();
        Assert.Equal(HttpStatusCode.OK, (await Start(client, first)).StatusCode);
        await Guess(client, first, "slate");

        var second = Guid.NewGuid();
        var blocked = await Start(client, second);
        Assert.Equal(HttpStatusCode.Conflict, blocked.StatusCode);
        Assert.Equal("active-elsewhere", (await blocked.Content.ReadFromJsonAsync<JsonElement>(Json)).GetProperty("error").GetString());

        await Task.Delay(TimeSpan.FromSeconds(1.5)); // the first device goes idle past the 1-second test lease

        var takeover = await Start(client, second);
        Assert.Equal(HttpStatusCode.OK, takeover.StatusCode);
        var resumed = await takeover.Content.ReadFromJsonAsync<JsonElement>(Json);
        Assert.Equal(1, resumed.GetProperty("attempt").GetProperty("guesses").GetArrayLength()); // same board
        Assert.True(resumed.GetProperty("attempt").GetProperty("activeOnThisDevice").GetBoolean());

        // The first device is now locked out.
        Assert.Equal(HttpStatusCode.Conflict, (await Guess(client, first, "trace")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Guess(client, second, "trace")).StatusCode);
    }

    [DbFact]
    public async Task Each_player_has_their_own_attempt()
    {
        await SeedTodayAsync();
        var (alice, aliceDevice) = await SignUpAsync();
        var (bob, bobDevice) = await SignUpAsync();
        await Start(alice, aliceDevice);
        await Guess(alice, aliceDevice, "crane");

        Assert.Equal(HttpStatusCode.OK, (await Start(bob, bobDevice)).StatusCode);
        var bobState = await bob.GetFromJsonAsync<JsonElement>($"/daily/word-guess?deviceId={bobDevice}", Json);
        Assert.Equal("playing", bobState.GetProperty("attempt").GetProperty("status").GetString());
    }
}
