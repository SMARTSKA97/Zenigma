using System.Collections.Concurrent;

namespace Zenigma.Api.Infrastructure;

/// <summary>
/// A short-lived, in-memory cache with "single flight": when many requests ask for the same thing at once, one of them
/// computes it and the rest wait for that answer, so a busy leaderboard costs the database one query, not hundreds.
/// A lifetime of zero turns the cache off (the tests do this so a result is never stale).
/// </summary>
public sealed class BoardCache(IConfiguration config, TimeProvider clock)
{
    private const int MaxEntries = 400;
    private readonly TimeSpan _ttl = TimeSpan.FromSeconds(Math.Max(0, config.GetValue("Cache:BoardSeconds", 20)));
    private readonly ConcurrentDictionary<string, Entry> _entries = new();

    private sealed class Entry
    {
        public DateTimeOffset Expires;
        public Lazy<Task<object>> Value = null!;
    }

    public async Task<T> GetAsync<T>(string key, Func<Task<T>> factory) where T : class
    {
        if (_ttl <= TimeSpan.Zero) return await factory();

        var now = clock.GetUtcNow();
        if (_entries.TryGetValue(key, out var hit) && hit.Expires > now)
        {
            try { return (T)await hit.Value.Value; }
            catch { _entries.TryRemove(key, out _); throw; }
        }

        if (_entries.Count >= MaxEntries) Sweep(now);

        var entry = new Entry { Expires = now + _ttl, Value = new Lazy<Task<object>>(async () => (await factory())!) };
        _entries[key] = entry;
        try { return (T)await entry.Value.Value; }
        catch
        {
            // A failed computation is never cached.
            _entries.TryRemove(new KeyValuePair<string, Entry>(key, entry));
            throw;
        }
    }

    private void Sweep(DateTimeOffset now)
    {
        foreach (var (key, e) in _entries)
            if (e.Expires <= now) _entries.TryRemove(key, out _);
        // Still full of live entries: drop everything rather than grow without bound.
        if (_entries.Count >= MaxEntries) _entries.Clear();
    }
}
