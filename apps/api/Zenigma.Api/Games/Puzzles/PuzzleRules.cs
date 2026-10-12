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
    public const string Zip = "zip";

    public static readonly string[] Games = [Queens, Tango, Sudoku, Zip];

    /// <summary>Practice tracks, each with its own 1000 levels (a game can have several variants, like Sudoku's classic and mini grids).</summary>
    public static readonly string[] Tracks = [Queens, Tango, "sudoku-classic", "sudoku-mini", Zip];

    public static string TrackOf(string game, string? variant) => string.IsNullOrEmpty(variant) ? game : $"{game}-{variant}";

    public static bool IsPuzzleGame(string game) => Array.IndexOf(Games, game) >= 0;

    /// <summary>The fastest a person could plausibly solve a puzzle after it was revealed. Faster submissions are refused.</summary>
    public static int MinSolveMs(string game, JsonElement puzzle) => game switch
    {
        Queens => 5_000,
        Tango => 6_000,
        Sudoku => puzzle.TryGetProperty("givens", out var g) && g.GetString()?.Length == 36 ? 12_000 : 40_000, // mini 6x6 or classic 9x9
        Zip => 4_000,
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
                Zip => VerifyZip(puzzle, solution),
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

    // Zip: solution lists every cell (row * size + column) in the order the path visits them. It must step to a neighbouring
    // cell each time, and pass the numbered cells in order from 1 to the highest, starting on 1 and ending on the highest.
    private static bool VerifyZip(JsonElement puzzle, JsonElement solution)
    {
        var size = puzzle.GetProperty("size").GetInt32();
        var numbers = puzzle.GetProperty("numbers").EnumerateArray().Select(x => x.GetInt32()).ToArray();
        var total = size * size;
        if (numbers.Length != total || solution.ValueKind != JsonValueKind.Array || solution.GetArrayLength() != total) return false;

        var path = solution.EnumerateArray().Select(x => x.ValueKind == JsonValueKind.Number ? x.GetInt32() : -1).ToArray();
        var seen = new bool[total];
        var top = numbers.Max();
        var expected = 1;
        for (var step = 0; step < total; step++)
        {
            var cell = path[step];
            if (cell < 0 || cell >= total || seen[cell]) return false;
            seen[cell] = true;
            if (step > 0)
            {
                var before = path[step - 1];
                var apart = Math.Abs(cell / size - before / size) + Math.Abs(cell % size - before % size);
                if (apart != 1) return false; // one step up, down, left or right
            }

            if (numbers[cell] != 0)
            {
                if (numbers[cell] != expected) return false; // numbers must be reached in order
                expected++;
            }
        }

        return top >= 2 && expected == top + 1 && numbers[path[total - 1]] == top;
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

    // Sudoku: 36 digits (mini 6x6, boxes 2 rows by 3 columns) or 81 digits (classic 9x9, boxes 3 by 3).
    private static bool VerifySudoku(JsonElement puzzle, JsonElement solution)
    {
        var cells = solution.ValueKind == JsonValueKind.String ? solution.GetString()! : "";
        var givens = puzzle.GetProperty("givens").GetString()!;
        if (givens.Length is not (36 or 81) || cells.Length != givens.Length) return false;
        var n = givens.Length == 36 ? 6 : 9;
        var boxRows = n == 6 ? 2 : 3;
        var boxCols = 3;
        if (cells.Any(c => c < '1' || c > '0' + n)) return false;

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
            var box = r / boxRows * (n / boxCols) + c / boxCols;
            if (!rows[r].Add(cells[i]) || !cols[c].Add(cells[i]) || !boxes[box].Add(cells[i])) return false;
        }

        return true;
    }
}
