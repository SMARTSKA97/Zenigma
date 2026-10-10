using System.Text.Json;
using Zenigma.Api.Games.WordGuess;

namespace Zenigma.Api.Tests;

/// <summary>Runs the same JSON vectors as the TypeScript engine (tests/vectors/word-guess).</summary>
public class WordGuessEngineTests
{
    private static JsonElement Load(string name) =>
        JsonDocument.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "vectors", "word-guess", name))).RootElement.Clone();

    public static IEnumerable<object[]> EvaluateCases() =>
        Load("evaluate.json").GetProperty("cases").EnumerateArray()
            .Select(c => new object[] { c.GetProperty("answer").GetString()!, c.GetProperty("guess").GetString()!, c.GetProperty("marks").GetString()! });

    public static IEnumerable<object[]> HardModeCases() =>
        Load("hard-mode.json").GetProperty("cases").EnumerateArray()
            .Select(c => new object[]
            {
                c.GetProperty("answer").GetString()!,
                string.Join(',', c.GetProperty("previous").EnumerateArray().Select(p => p.GetString()!)),
                c.GetProperty("next").GetString()!,
                c.GetProperty("problem").ValueKind == JsonValueKind.Null ? "" : c.GetProperty("problem").GetRawText(),
            });

    [Theory]
    [MemberData(nameof(EvaluateCases))]
    public void Evaluate_matches_the_shared_vectors(string answer, string guess, string expected)
    {
        Assert.Equal(expected, WordGuessEngine.MarksToString(WordGuessEngine.Evaluate(guess, answer)));
    }

    [Theory]
    [MemberData(nameof(HardModeCases))]
    public void Hard_mode_matches_the_shared_vectors(string answer, string previous, string next, string expectedProblem)
    {
        var prior = previous.Length == 0 ? [] : previous.Split(',').ToList();
        var problem = WordGuessEngine.FindHardModeProblem(prior, answer, next);

        if (expectedProblem.Length == 0)
        {
            Assert.Null(problem);
            return;
        }

        var expected = JsonDocument.Parse(expectedProblem).RootElement;
        Assert.NotNull(problem);
        Assert.Equal(expected.GetProperty("reason").GetString(), problem!.Reason);
        Assert.Equal(expected.GetProperty("letter").GetString(), problem.Letter);
        if (expected.TryGetProperty("index", out var index)) Assert.Equal(index.GetInt32(), problem.Index);
    }

    [Fact]
    public void Word_list_loads_and_knows_common_words()
    {
        var words = new WordList();
        Assert.True(words.Count > 10_000);
        Assert.True(words.IsValid("crane"));
        Assert.False(words.IsValid("zzzzz"));
    }
}
