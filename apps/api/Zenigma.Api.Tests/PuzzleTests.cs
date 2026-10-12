using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Zenigma.Api.Data;
using Zenigma.Api.Games.Puzzles;
using Zenigma.Api.Infrastructure;

namespace Zenigma.Api.Tests;

public class PuzzleFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(Microsoft.AspNetCore.Hosting.IWebHostBuilder builder)
    {
        builder.UseSetting("ConnectionStrings:Default", Environment.GetEnvironmentVariable("ZENIGMA_TEST_DB") ?? "Host=unused");
        builder.UseSetting("Jwt:Key", Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(48)));
        builder.UseSetting("Puzzle:MinSolveMs", "0"); // tests do not wait for the "too fast" guard
    }
}

public class PuzzleRulesTests
{
    private static readonly string VectorsDir = Path.Combine(AppContext.BaseDirectory, "vectors", "puzzles");

    public static IEnumerable<object[]> Cases()
    {
        foreach (var game in PuzzleRules.Games)
        {
            using var doc = JsonDocument.Parse(File.ReadAllText(Path.Combine(VectorsDir, $"{game}.json")));
            foreach (var c in doc.RootElement.EnumerateArray())
            {
                yield return [game, c.GetProperty("name").GetString()!, c.GetProperty("puzzle").GetRawText(), c.GetProperty("solution").GetRawText(), c.GetProperty("valid").GetBoolean()];
            }
        }
    }

    [Theory]
    [MemberData(nameof(Cases))]
    public void Matches_the_shared_vectors(string game, string name, string puzzle, string solution, bool valid)
    {
        using var p = JsonDocument.Parse(puzzle);
        using var s = JsonDocument.Parse(solution);
        Assert.True(valid == PuzzleRules.Verify(game, p.RootElement, s.RootElement), $"{game}: {name}");
    }

    [Fact]
    public void Every_shipped_level_set_is_complete()
    {
        var levels = new PracticeLevels();
        foreach (var game in PuzzleRules.Games) Assert.Equal(200, levels.Count(game));
    }

    [Fact]
    public void Shipped_levels_accept_their_known_solutions()
    {
        var levels = new PracticeLevels();
        using var doc = JsonDocument.Parse(File.ReadAllText(Path.Combine(VectorsDir, "practice-levels.json")));
        foreach (var c in doc.RootElement.EnumerateArray())
        {
            var game = c.GetProperty("game").GetString()!;
            var level = c.GetProperty("level").GetInt32();
            Assert.True(PuzzleRules.Verify(game, levels.Get(game, level)!.Value, c.GetProperty("solution")), $"{game} level {level}");
        }
    }

    [Fact]
    public void Garbage_is_a_wrong_answer_not_a_crash()
    {
        using var puzzle = JsonDocument.Parse("""{"size":5,"regions":[1]}""");
        using var solution = JsonDocument.Parse("""{"x":1}""");
        Assert.False(PuzzleRules.Verify("queens", puzzle.RootElement, solution.RootElement));
        Assert.False(PuzzleRules.Verify("nonsense", puzzle.RootElement, solution.RootElement));
    }
}

public class PuzzleTests : IClassFixture<PuzzleFactory>
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private static readonly string Password = Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(12));
    private static readonly string VectorsDir = Path.Combine(AppContext.BaseDirectory, "vectors", "puzzles");
    private readonly PuzzleFactory _factory;

    public PuzzleTests(PuzzleFactory factory) => _factory = factory;

    private static (JsonElement puzzle, JsonElement solution) ValidVector(string game)
    {
        using var doc = JsonDocument.Parse(File.ReadAllText(Path.Combine(VectorsDir, $"{game}.json")));
        var c = doc.RootElement.EnumerateArray().First(x => x.GetProperty("valid").GetBoolean());
        return (c.GetProperty("puzzle").Clone(), c.GetProperty("solution").Clone());
    }

    private async Task SeedTodayAsync(string game, JsonElement puzzle)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var today = IstClock.Today(DateTimeOffset.UtcNow);
        var json = puzzle.GetRawText();
        await db.Database.ExecuteSqlInterpolatedAsync(
            $"INSERT INTO daily_puzzles (game, puzzle_date, puzzle) VALUES ({game}, {today}, {json}::jsonb) ON CONFLICT (game, puzzle_date) DO UPDATE SET puzzle = EXCLUDED.puzzle");
        // Start every test from a clean board for this game and day, so ranks are predictable.
        await db.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM puzzle_attempts WHERE game = {game} AND puzzle_date = {today}");
    }

    private async Task<(HttpClient client, Guid device)> SignUpAsync(string? displayName = null)
    {
        var client = _factory.CreateClient();
        var device = Guid.NewGuid();
        var response = await client.PostAsJsonAsync("/auth/register", new { email = $"{Guid.NewGuid():N}@example.com", password = Password, deviceId = device, displayName });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(Json);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body.GetProperty("accessToken").GetString());
        return (client, device);
    }

    [DbFact]
    public async Task Plays_a_daily_puzzle_and_appears_on_the_leaderboard()
    {
        var (puzzle, solution) = ValidVector("queens");
        await SeedTodayAsync("queens", puzzle);
        var (client, device) = await SignUpAsync("Ada");

        var before = await client.GetFromJsonAsync<JsonElement>($"/daily/queens?deviceId={device}", Json);
        Assert.Equal(JsonValueKind.Null, before.GetProperty("attempt").ValueKind);

        var started = await (await client.PostAsJsonAsync("/daily/queens/start", new { deviceId = device })).Content.ReadFromJsonAsync<JsonElement>(Json);
        Assert.Equal("playing", started.GetProperty("attempt").GetProperty("status").GetString());
        Assert.Equal(JsonValueKind.Object, started.GetProperty("attempt").GetProperty("puzzle").ValueKind);

        var wrong = await client.PostAsJsonAsync("/daily/queens/submit", new { deviceId = device, solution = new[] { 0, 0, 0, 0, 0 } });
        Assert.Equal(HttpStatusCode.UnprocessableEntity, wrong.StatusCode);

        var done = await client.PostAsJsonAsync("/daily/queens/submit", new { deviceId = device, solution });
        Assert.Equal(HttpStatusCode.OK, done.StatusCode);
        var result = (await done.Content.ReadFromJsonAsync<JsonElement>(Json)).GetProperty("attempt");
        Assert.Equal("solved", result.GetProperty("status").GetString());
        Assert.Equal(1, result.GetProperty("rank").GetInt32());
        Assert.Equal(JsonValueKind.Null, result.GetProperty("puzzle").ValueKind);

        // Single use.
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync("/daily/queens/start", new { deviceId = device })).StatusCode);

        // Public board, with this player marked.
        var board = await client.GetFromJsonAsync<JsonElement>("/leaderboards/queens?kind=daily&period=today", Json);
        var first = board.GetProperty("entries")[0];
        Assert.Equal("Ada", first.GetProperty("name").GetString());
        Assert.True(first.GetProperty("isMe").GetBoolean());
        Assert.Equal(JsonValueKind.Object, board.GetProperty("me").ValueKind);

        var anonymous = await _factory.CreateClient().GetFromJsonAsync<JsonElement>("/leaderboards/queens?kind=daily&period=today", Json);
        Assert.False(anonymous.GetProperty("entries")[0].GetProperty("isMe").GetBoolean());
        Assert.Equal(JsonValueKind.Null, anonymous.GetProperty("me").ValueKind);

        // The Daily tab reflects it.
        var hub = await client.GetFromJsonAsync<JsonElement>("/daily", Json);
        var queens = hub.GetProperty("games").EnumerateArray().First(g => g.GetProperty("game").GetString() == "queens");
        Assert.Equal("solved", queens.GetProperty("status").GetString());
    }

    [DbFact]
    public async Task The_puzzle_goes_only_to_the_device_that_is_playing()
    {
        var (puzzle, _) = ValidVector("tango");
        await SeedTodayAsync("tango", puzzle);
        var (client, device) = await SignUpAsync();
        await client.PostAsJsonAsync("/daily/tango/start", new { deviceId = device });

        var other = Guid.NewGuid();
        var seenElsewhere = await client.GetFromJsonAsync<JsonElement>($"/daily/tango?deviceId={other}", Json);
        Assert.Equal(JsonValueKind.Null, seenElsewhere.GetProperty("attempt").GetProperty("puzzle").ValueKind);
        Assert.False(seenElsewhere.GetProperty("attempt").GetProperty("activeOnThisDevice").GetBoolean());

        // A second device cannot take over while the first is active.
        var clash = await client.PostAsJsonAsync("/daily/tango/start", new { deviceId = other });
        Assert.Equal(HttpStatusCode.Conflict, clash.StatusCode);
    }

    [DbFact]
    public async Task Faster_solves_rank_higher()
    {
        var (puzzle, solution) = ValidVector("sudoku");
        await SeedTodayAsync("sudoku", puzzle);
        var (a, deviceA) = await SignUpAsync("Quick");
        var (b, deviceB) = await SignUpAsync("Slow");
        await a.PostAsJsonAsync("/daily/sudoku/start", new { deviceId = deviceA });
        await a.PostAsJsonAsync("/daily/sudoku/submit", new { deviceId = deviceA, solution });
        await b.PostAsJsonAsync("/daily/sudoku/start", new { deviceId = deviceB });
        await Task.Delay(600);
        await b.PostAsJsonAsync("/daily/sudoku/submit", new { deviceId = deviceB, solution });

        var board = await a.GetFromJsonAsync<JsonElement>("/leaderboards/sudoku?kind=daily&period=today", Json);
        var names = board.GetProperty("entries").EnumerateArray().Select(e => e.GetProperty("name").GetString()).ToList();
        Assert.True(names.IndexOf("Quick") < names.IndexOf("Slow"));
    }

    [DbFact]
    public async Task Stats_count_a_solved_daily_and_start_a_streak()
    {
        var (puzzle, solution) = ValidVector("queens");
        await SeedTodayAsync("queens", puzzle);
        var (client, device) = await SignUpAsync("Streaker");
        await client.PostAsJsonAsync("/daily/queens/start", new { deviceId = device });
        await client.PostAsJsonAsync("/daily/queens/submit", new { deviceId = device, solution });

        var stats = await client.GetFromJsonAsync<JsonElement>("/stats", Json);
        var queens = stats.GetProperty("games").EnumerateArray().First(g => g.GetProperty("game").GetString() == "queens");
        Assert.Equal(1, queens.GetProperty("solved").GetInt32());
        Assert.Equal(1, queens.GetProperty("current").GetInt32());
        Assert.Equal(1, queens.GetProperty("recent").GetArrayLength());
        Assert.Equal(0, stats.GetProperty("rewards").GetProperty("freezes").GetInt32());
    }

    [DbFact]
    public async Task Stats_need_a_signed_in_player()
    {
        var response = await _factory.CreateClient().GetAsync("/stats");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [DbFact]
    public async Task Practice_solves_count_only_when_the_solution_is_real()
    {
        var (client, device) = await SignUpAsync("Grinder");
        using var doc = JsonDocument.Parse(File.ReadAllText(Path.Combine(VectorsDir, "practice-levels.json")));
        var known = doc.RootElement.EnumerateArray().First(c => c.GetProperty("game").GetString() == "queens" && c.GetProperty("level").GetInt32() == 1);

        object Solved(JsonElement solution, int level) => new
        {
            id = Guid.NewGuid(),
            kind = "puzzle.practice.solved",
            payload = new { game = "queens", level, solution, elapsedMs = 40_000 },
            clientCreatedAt = DateTimeOffset.UtcNow,
        };

        var push = await client.PostAsJsonAsync("/sync/push", new
        {
            deviceId = device,
            events = new[]
            {
                Solved(known.GetProperty("solution"), 1),
                Solved(known.GetProperty("solution"), 1),   // the same level again: counted once
                Solved(known.GetProperty("solution"), 2),   // right shape, wrong level: not a solution of level 2
                new
                {
                    id = Guid.NewGuid(),
                    kind = "wordguess.finished",
                    payload = new { mode = "practice", answer = "crane", guesses = new[] { "slate", "crane" }, status = "won", hard = false },
                    clientCreatedAt = DateTimeOffset.UtcNow,
                },
            },
        });
        Assert.Equal(HttpStatusCode.OK, push.StatusCode);

        var queens = await client.GetFromJsonAsync<JsonElement>("/leaderboards/queens?kind=practice&period=all", Json);
        var mine = queens.GetProperty("entries").EnumerateArray().First(e => e.GetProperty("isMe").GetBoolean());
        Assert.Equal(1, mine.GetProperty("value").GetInt64());

        var words = await client.GetFromJsonAsync<JsonElement>("/leaderboards/word-guess?kind=practice&period=week", Json);
        Assert.Equal(1, words.GetProperty("me").GetProperty("value").GetInt64());
    }

    [DbFact]
    public async Task Leaderboard_requests_are_validated()
    {
        var client = _factory.CreateClient();
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/leaderboards/chess")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("/leaderboards/queens?kind=practice&period=today")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/leaderboards/tango?kind=daily&period=all")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/daily")).StatusCode);
    }
}
