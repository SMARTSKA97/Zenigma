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

    /// <summary>
    /// Checks a batch of finished practice events and records the real solves in one statement, instead of one round trip each.
    /// Anything that does not check out is quietly ignored.
    /// </summary>
    public async Task RecordManyAsync(AppDbContext db, string userId, IReadOnlyList<(string Kind, JsonElement Payload, DateTimeOffset At)> events, CancellationToken ct)
    {
        var games = new List<string>();
        var keys = new List<string>();
        var times = new List<DateTime>();
        var elapsed = new List<int?>();
        var best = new List<int?>();
        var tries = new List<short?>();
        foreach (var (kind, payload, at) in events)
        {
            (string game, string key, int? elapsed, int? best, short? tries)? solve = kind switch
            {
                WordGuessKind => ReadWordGuess(payload),
                PuzzleKind => ReadPuzzle(payload),
                _ => null,
            };
            if (solve is null) continue;
            games.Add(solve.Value.game);
            keys.Add(solve.Value.key);
            times.Add(at.UtcDateTime);
            elapsed.Add(solve.Value.elapsed);
            best.Add(solve.Value.best);
            tries.Add(solve.Value.tries);
        }

        if (games.Count == 0) return;
        await db.Database.ExecuteSqlRawAsync(
            """
            INSERT INTO practice_solves (user_id, game, level_key, solved_at, elapsed_ms, best_ms, tries)
            SELECT @user, t.game, t.key, MIN(t.at), MIN(t.elapsed), MIN(t.best), MIN(t.tries)
            FROM unnest(@games, @keys, @times, @elapsed, @best, @tries) AS t(game, key, at, elapsed, best, tries)
            GROUP BY t.game, t.key
            ON CONFLICT (user_id, game, level_key) DO UPDATE SET
                best_ms = LEAST(practice_solves.best_ms, EXCLUDED.best_ms),
                tries   = LEAST(practice_solves.tries, EXCLUDED.tries)
            """,
            [
                new NpgsqlParameter("user", userId),
                new NpgsqlParameter("games", NpgsqlTypes.NpgsqlDbType.Array | NpgsqlTypes.NpgsqlDbType.Text) { Value = games.ToArray() },
                new NpgsqlParameter("keys", NpgsqlTypes.NpgsqlDbType.Array | NpgsqlTypes.NpgsqlDbType.Text) { Value = keys.ToArray() },
                new NpgsqlParameter("times", NpgsqlTypes.NpgsqlDbType.Array | NpgsqlTypes.NpgsqlDbType.TimestampTz) { Value = times.ToArray() },
                new NpgsqlParameter("elapsed", NpgsqlTypes.NpgsqlDbType.Array | NpgsqlTypes.NpgsqlDbType.Integer) { Value = elapsed.ToArray() },
                new NpgsqlParameter("best", NpgsqlTypes.NpgsqlDbType.Array | NpgsqlTypes.NpgsqlDbType.Integer) { Value = best.ToArray() },
                new NpgsqlParameter("tries", NpgsqlTypes.NpgsqlDbType.Array | NpgsqlTypes.NpgsqlDbType.Smallint) { Value = tries.ToArray() },
            ],
            ct);
    }

    private (string, string, int?, int?, short?)? ReadWordGuess(JsonElement p)
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
            return ("word-guess", answer, null, null, (short)guesses.Count);
        }
        catch (Exception e) when (e is InvalidOperationException or KeyNotFoundException or JsonException or FormatException)
        {
            return null;
        }
    }

    private (string, string, int?, int?, short?)? ReadPuzzle(JsonElement p)
    {
        try
        {
            var game = p.GetProperty("game").GetString() ?? "";
            var level = p.GetProperty("level").GetInt32();
            var variant = p.TryGetProperty("variant", out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
            if (!PuzzleRules.IsPuzzleGame(game) || levels.Get(PuzzleRules.TrackOf(game, variant), level) is not { } puzzle) return null;
            if (!PuzzleRules.Verify(game, puzzle, p.GetProperty("solution"))) return null;
            int? elapsed = p.TryGetProperty("elapsedMs", out var e) && e.ValueKind == JsonValueKind.Number ? Math.Clamp(e.GetInt32(), 0, 86_400_000) : null;
            // A solve that used hints still counts as solved, but its time is not ranked.
            var hinted = p.TryGetProperty("hinted", out var h) && h.ValueKind == JsonValueKind.True;
            return (game, variant is null ? level.ToString() : $"{variant}:{level}", elapsed, hinted ? null : elapsed, null);
        }
        catch (Exception e) when (e is InvalidOperationException or KeyNotFoundException or JsonException or FormatException)
        {
            return null;
        }
    }
}
