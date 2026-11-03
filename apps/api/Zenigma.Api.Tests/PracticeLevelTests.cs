using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Zenigma.Api.Tests;

public class PracticeLevelTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public PracticeLevelTests(ApiFactory factory) => _factory = factory;

    [DbFact]
    public async Task The_level_board_checks_its_input_and_answers_with_an_empty_board_when_nobody_has_played()
    {
        var c = _factory.CreateClient();
        Assert.Equal(HttpStatusCode.NotFound, (await c.GetAsync("/leaderboards/practice-level?game=nope&level=1")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.GetAsync("/leaderboards/practice-level?game=queens&level=0")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.GetAsync("/leaderboards/practice-level?game=queens&level=1&variant=DROP")).StatusCode);

        var board = await c.GetFromJsonAsync<JsonElement>("/leaderboards/practice-level?game=queens&level=987", new JsonSerializerOptions(JsonSerializerDefaults.Web));
        Assert.Equal("987", board.GetProperty("date").GetString());
        Assert.Empty(board.GetProperty("entries").EnumerateArray());

        var words = await c.GetFromJsonAsync<JsonElement>("/leaderboards/practice-level?game=word-guess", new JsonSerializerOptions(JsonSerializerDefaults.Web));
        Assert.Equal("avg", words.GetProperty("date").GetString());
    }
}
