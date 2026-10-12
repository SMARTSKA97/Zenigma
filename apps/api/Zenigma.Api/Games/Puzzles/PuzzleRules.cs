using System.Text.Json;

namespace Zenigma.Api.Games.Puzzles;

/// <summary>
/// Checks a finished Queens, Tango or Sudoku solution against the rules of the puzzle. Every puzzle has exactly one
/// solution, so no answer is stored anywhere: a submission is correct if it satisfies every rule.
/// The TypeScript engines in the web app implement the same rules and run against the same vectors (tests/vectors/puzzles).
/// </summary>
public static class PuzzleRules
{
    public const string Queens = "queens";
    public const string Tango = "tango";
    public const string Sudoku = "sudoku";

    public static readonly string[] Games = [Queens, Tango, Sudoku];

    public static bool IsPuzzleGame(string game) => Array.IndexOf(Games, game) >= 0;

    /// <summary>The fastest a person could plausibly solve a puzzle after it was revealed. Faster submissions are refused.</summary>
    public static int MinSolveMs(string game) => game switch
    {
        Queens => 5_000,
        Tango => 6_000,
        Sudoku => 40_000,
        _ => 5_000,
    };

    public static bool Verify(string game, JsonElement puzzle, JsonElement solution)
    {
        try
        {
            return game switch
            {
                Queens => VerifyQueens(puzzle, solution),
                Tango => VerifyTango(puzzle, solution),
                Sudoku => VerifySudoku(puzzle, solution),
                _ => false,
            };
        }
        catch (Exception e) when (e is InvalidOperationException or KeyNotFoundException or FormatException or JsonException)
        {
            return false; // malformed input is simply a wrong answer
        }
    }

    // Queens: solution is an array with the column of the queen in each row.
    private static bool VerifyQueens(JsonElement puzzle, JsonElement solution)
    {
        var size = puzzle.GetProperty("size").GetInt32();
        var regions = puzzle.GetProperty("regions").EnumerateArray().Select(x => x.GetInt32()).ToArray();
        if (regions.Length != size * size || solution.ValueKind != JsonValueKind.Array || solution.GetArrayLength() != size) return false;

        var cols = solution.EnumerateArray().Select(x => x.ValueKind == JsonValueKind.Number ? x.GetInt32() : -1).ToArray();
        var usedCols = new HashSet<int>();
        var usedRegions = new HashSet<int>();
        for (var row = 0; row < size; row++)
        {
            var col = cols[row];
            if (col < 0 || col >= size) return false;
            if (!usedCols.Add(col)) return false;
            if (!usedRegions.Add(regions[row * size + col])) return false;
            if (row > 0 && Math.Abs(cols[row - 1] - col) < 2) return false; // touching, even diagonally
        }

        return true;
    }

    // Tango: 36 characters of 's' and 'm'.
    private static bool VerifyTango(JsonElement puzzle, JsonElement solution)
    {
        const int n = 6;
        var cells = solution.ValueKind == JsonValueKind.String ? solution.GetString()! : "";
        var givens = puzzle.GetProperty("givens").GetString()!;
        if (cells.Length != n * n || givens.Length != n * n) return false;
        if (cells.Any(c => c is not ('s' or 'm'))) return false;

        for (var i = 0; i < n * n; i++)
        {
            if (givens[i] != '.' && givens[i] != cells[i]) return false;
        }

        for (var line = 0; line < n; line++)
        {
            var rowSuns = 0;
            var colSuns = 0;
            for (var k = 0; k < n; k++)
            {
                if (cells[line * n + k] == 's') rowSuns++;
                if (cells[k * n + line] == 's') colSuns++;
                if (k >= 2)
                {
                    if (cells[line * n + k] == cells[line * n + k - 1] && cells[line * n + k] == cells[line * n + k - 2]) return false;
                    if (cells[k * n + line] == cells[(k - 1) * n + line] && cells[k * n + line] == cells[(k - 2) * n + line]) return false;
                }
            }

            if (rowSuns != n / 2 || colSuns != n / 2) return false;
        }

        foreach (var edge in puzzle.GetProperty("edges").EnumerateArray())
        {
            var a = edge[0].GetInt32();
            var b = edge[1].GetInt32();
            var same = cells[a] == cells[b];
            if (edge[2].GetString() == "=" ? !same : same) return false;
        }

        return true;
    }

    // Sudoku: 81 digits, boxes are 3 by 3.
    private static bool VerifySudoku(JsonElement puzzle, JsonElement solution)
    {
        const int n = 9;
        var cells = solution.ValueKind == JsonValueKind.String ? solution.GetString()! : "";
        var givens = puzzle.GetProperty("givens").GetString()!;
        if (cells.Length != n * n || givens.Length != n * n) return false;
        if (cells.Any(c => c is < '1' or > '9')) return false;

        for (var i = 0; i < n * n; i++)
        {
            if (givens[i] != '0' && givens[i] != cells[i]) return false;
        }

        var rows = new HashSet<char>[n];
        var cols = new HashSet<char>[n];
        var boxes = new HashSet<char>[n];
        for (var i = 0; i < n; i++)
        {
            rows[i] = [];
            cols[i] = [];
            boxes[i] = [];
        }

        for (var i = 0; i < n * n; i++)
        {
            var r = i / n;
            var c = i % n;
            var box = r / 3 * 3 + c / 3;
            if (!rows[r].Add(cells[i]) || !cols[c].Add(cells[i]) || !boxes[box].Add(cells[i])) return false;
        }

        return true;
    }
}
