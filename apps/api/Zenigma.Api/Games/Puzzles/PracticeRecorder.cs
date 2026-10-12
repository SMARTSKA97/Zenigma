using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Zenigma.Api.Data;
using Zenigma.Api.Games.WordGuess;

namespace Zenigma.Api.Games.Puzzles;

/// <summary>
/// Turns synced practice results into leaderboard rows. Practice is played offline, so the server cannot time it; it can,
/// and does, check that every claimed solve is a real one. Only the number of distinct levels solved counts.
/// </summary>
public sealed class PracticeRecorder(WordList words, PracticeLevels levels)
{
    public const string WordGuessKind = "wordguess.finished";
    public const string PuzzleKind = "puzzle.practice.solved";

    public static bool IsPracticeKind(string kind) => kind is WordGuessKind or PuzzleKind;

    /// <summary>Returns true when a new solve was recorded. Anything that does not check out is quietly ignored.</summary>
    public async Task<bool> RecordAsync(AppDbContext db, string userId, string kind, JsonElement payload, DateTimeOffset at, CancellationToken ct)
    {
        (string game, string key, int? elapsed)? solve = kind switch
        {
            WordGuessKind => ReadWordGuess(payload),
            PuzzleKind => ReadPuzzle(payload),
            _ => null,
        };
        if (solve is null) return false;

        var (game, key, elapsedMs) = solve.Value;
        var inserted = await db.Database.ExecuteSqlRawAsync(
            """
            INSERT INTO practice_solves (user_id, game, level_key, solved_at, elapsed_ms)
            VALUES (@user, @game, @key, @at, @elapsed)
            ON CONFLICT (user_id, game, level_key) DO NOTHING
            """,
            [
                new NpgsqlParameter("user", userId),
                new NpgsqlParameter("game", game),
                new NpgsqlParameter("key", key),
                new NpgsqlParameter("at", at.ToUniversalTime()),
                new NpgsqlParameter("elapsed", (object?)elapsedMs ?? DBNull.Value),
            ],
            ct);
        return inserted == 1;
    }

    private (string, string, int?)? ReadWordGuess(JsonElement p)
    {
        try
        {
            if (!p.TryGetProperty("mode", out var mode) || mode.GetString() != "practice") return null;
            if (p.GetProperty("status").GetString() != "won") return null;
            var answer = p.GetProperty("answer").GetString()?.ToLowerInvariant();
            var guesses = p.GetProperty("guesses").EnumerateArray().Select(g => g.GetString()?.ToLowerInvariant() ?? "").ToList();
            if (answer is null || guesses.Count is 0 or > WordGuessEngine.MaxGuesses) return null;
            if (!words.IsValid(answer) || guesses.Any(g => !words.IsValid(g))) return null;
            if (guesses[^1] != answer || guesses.SkipLast(1).Contains(answer)) return null;
            return ("word-guess", answer, null);
        }
        catch (Exception e) when (e is InvalidOperationException or KeyNotFoundException or JsonException or FormatException)
        {
            return null;
        }
    }

    private (string, string, int?)? ReadPuzzle(JsonElement p)
    {
        try
        {
            var game = p.GetProperty("game").GetString() ?? "";
            var level = p.GetProperty("level").GetInt32();
            if (!PuzzleRules.IsPuzzleGame(game) || levels.Get(game, level) is not { } puzzle) return null;
            if (!PuzzleRules.Verify(game, puzzle, p.GetProperty("solution"))) return null;
            int? elapsed = p.TryGetProperty("elapsedMs", out var e) && e.ValueKind == JsonValueKind.Number ? Math.Clamp(e.GetInt32(), 0, 86_400_000) : null;
            return (game, level.ToString(), elapsed);
        }
        catch (Exception e) when (e is InvalidOperationException or KeyNotFoundException or JsonException or FormatException)
        {
            return null;
        }
    }
}
