namespace Zenigma.Api.Games.WordGuess;

public enum Mark
{
    Absent = 0,
    Present = 1,
    Correct = 2,
}

/// <summary>Why a hard-mode guess was refused: "position" (a green letter moved) or "missing" (a revealed letter was dropped).</summary>
public record HardModeProblem(string Reason, string Letter, int? Index);

/// <summary>
/// Word Guess rules, identical to the TypeScript engine in the web app. Both are tested against the shared JSON
/// vectors in tests/vectors/word-guess, so they cannot drift apart.
/// </summary>
public static class WordGuessEngine
{
    public const int WordLength = 5;
    public const int MaxGuesses = 6;

    /// <summary>Greens first, then yellows from the answer letters that are still unmatched (so repeats are counted).</summary>
    public static Mark[] Evaluate(string guess, string answer)
    {
        var marks = new Mark[WordLength];
        var remaining = new Dictionary<char, int>();

        for (var i = 0; i < WordLength; i++)
        {
            if (guess[i] == answer[i])
            {
                marks[i] = Mark.Correct;
            }
            else
            {
                remaining[answer[i]] = remaining.GetValueOrDefault(answer[i]) + 1;
            }
        }

        for (var i = 0; i < WordLength; i++)
        {
            if (marks[i] == Mark.Correct) continue;
            if (remaining.TryGetValue(guess[i], out var left) && left > 0)
            {
                marks[i] = Mark.Present;
                remaining[guess[i]] = left - 1;
            }
        }

        return marks;
    }

    /// <summary>Compact form used in vectors and API responses: c = correct, p = present, a = absent.</summary>
    public static string MarksToString(IEnumerable<Mark> marks) =>
        string.Concat(marks.Select(m => m switch
        {
            Mark.Correct => 'c',
            Mark.Present => 'p',
            _ => 'a',
        }));

    /// <summary>Hard mode: green letters stay put and every revealed letter must be reused. Null means the guess is legal.</summary>
    public static HardModeProblem? FindHardModeProblem(IReadOnlyList<string> previous, string answer, string next)
    {
        if (previous.Count == 0) return null;

        var last = previous[^1];
        var marks = Evaluate(last, answer);

        for (var i = 0; i < WordLength; i++)
        {
            if (marks[i] == Mark.Correct && next[i] != last[i])
            {
                return new HardModeProblem("position", last[i].ToString(), i + 1);
            }
        }

        var needed = new Dictionary<char, int>();
        for (var i = 0; i < WordLength; i++)
        {
            if (marks[i] != Mark.Absent) needed[last[i]] = needed.GetValueOrDefault(last[i]) + 1;
        }

        foreach (var (letter, count) in needed)
        {
            if (next.Count(c => c == letter) < count) return new HardModeProblem("missing", letter.ToString(), null);
        }

        return null;
    }
}
