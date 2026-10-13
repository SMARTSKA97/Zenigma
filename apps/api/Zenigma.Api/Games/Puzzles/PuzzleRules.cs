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
    public const string Patches = "patches";

    public static readonly string[] Games = [Queens, Tango, Sudoku, Zip, Patches];

    /// <summary>Practice tracks, each with its own levels: 1000 each, or 200 for every Sudoku kind and difficulty tier (classic or mini, easy to insane).</summary>
    public static readonly string[] Tracks =
    [
        Queens, Tango,
        .. new[] { "classic", "mini" }.SelectMany(kind => new[] { "easy", "medium", "hard", "challenging", "insane" }.Select(tier => $"sudoku-{kind}-{tier}")),
        "sudoku-diagonal", "sudoku-knight", "sudoku-windoku", "sudoku-disjoint",
        Zip, Patches,
    ];

    public static string TrackOf(string game, string? variant) => string.IsNullOrEmpty(variant) ? game : $"{game}-{variant}";

    public static bool IsPuzzleGame(string game) => Array.IndexOf(Games, game) >= 0;

    /// <summary>The fastest a person could plausibly solve a puzzle after it was revealed. Faster submissions are refused.</summary>
    public static int MinSolveMs(string game, JsonElement puzzle) => game switch
    {
        Queens => 5_000,
        Tango => 6_000,
        Sudoku => puzzle.TryGetProperty("givens", out var g) && g.GetString()?.Length == 36 ? 12_000 : 40_000, // mini 6x6 or classic 9x9
        Zip => 4_000,
        Patches => 6_000,
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
                Patches => VerifyPatches(puzzle, solution),
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

    // Patches: the solution is a list of rectangles [row0, col0, row1, col1] (inclusive). Together they must cover every cell exactly
    // once, and each must hold exactly one clue, have that clue's area, and match its shape (1 wide, 2 tall, 3 square, 0 any).
    private static bool VerifyPatches(JsonElement puzzle, JsonElement solution)
    {
        var size = puzzle.GetProperty("size").GetInt32();
        var clues = puzzle.GetProperty("clues").EnumerateArray().Select(c => c.EnumerateArray().Select(x => x.GetInt32()).ToArray()).ToArray();
        if (size < 2 || size > 12 || solution.ValueKind != JsonValueKind.Array || solution.GetArrayLength() != clues.Length) return false;

        var owner = new int[size * size];
        var id = 0;
        foreach (var rect in solution.EnumerateArray())
        {
            id++;
            if (rect.ValueKind != JsonValueKind.Array || rect.GetArrayLength() != 4) return false;
            var v = rect.EnumerateArray().Select(x => x.ValueKind == JsonValueKind.Number ? x.GetInt32() : -1).ToArray();
            var (r0, c0, r1, c1) = (v[0], v[1], v[2], v[3]);
            if (r0 < 0 || c0 < 0 || r1 < r0 || c1 < c0 || r1 >= size || c1 >= size) return false;

            for (var r = r0; r <= r1; r++)
            {
                for (var c = c0; c <= c1; c++)
                {
                    if (owner[r * size + c] != 0) return false; // overlap
                    owner[r * size + c] = id;
                }
            }

            var (w, h) = (c1 - c0 + 1, r1 - r0 + 1);
            var inside = clues.Where(k => k[0] / size >= r0 && k[0] / size <= r1 && k[0] % size >= c0 && k[0] % size <= c1).ToArray();
            if (inside.Length != 1) return false;
            var (area, shape) = (inside[0][1], inside[0][2]);
            if (area != w * h) return false;
            var actual = w == h ? 3 : w > h ? 1 : 2;
            if (shape != 0 && shape != actual) return false;
        }

        return owner.All(o => o != 0); // nothing left uncovered
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

        // One more rule on the classic grid: both long diagonals hold each digit once ("diagonal"), or no digit repeats a knight's move away ("knight").
        var rule = puzzle.TryGetProperty("rule", out var ruleElement) && ruleElement.ValueKind == JsonValueKind.String ? ruleElement.GetString() : null;
        if (rule is not null)
        {
            if (n != 9) return false;
            if (rule == "diagonal")
            {
                var main = new HashSet<char>();
                var anti = new HashSet<char>();
                for (var k = 0; k < n; k++)
                {
                    if (!main.Add(cells[k * n + k]) || !anti.Add(cells[k * n + (n - 1 - k)])) return false;
                }
            }
            else if (rule == "knight")
            {
                int[][] moves = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
                for (var i = 0; i < n * n; i++)
                {
                    foreach (var m in moves)
                    {
                        int rr = i / n + m[0], cc = i % n + m[1];
                        if (rr >= 0 && rr < n && cc >= 0 && cc < n && cells[rr * n + cc] == cells[i]) return false;
                    }
                }
            }
            else if (rule == "windoku")
            {
                foreach (var (r0, c0) in new[] { (1, 1), (1, 5), (5, 1), (5, 5) })
                {
                    var window = new HashSet<char>();
                    for (var a = 0; a < 3; a++)
                        for (var b = 0; b < 3; b++)
                            if (!window.Add(cells[(r0 + a) * n + c0 + b])) return false;
                }
            }
            else if (rule == "disjoint")
            {
                for (var g = 0; g < 9; g++)
                {
                    var spot = new HashSet<char>();
                    for (var b = 0; b < 9; b++)
                        if (!spot.Add(cells[(b / 3 * 3 + g / 3) * n + b % 3 * 3 + g % 3])) return false;
                }
            }
            else
            {
                return false;
            }
        }

        return true;
    }
}
