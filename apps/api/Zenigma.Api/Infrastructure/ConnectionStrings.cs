using Npgsql;

namespace Zenigma.Api.Infrastructure;

public static class ConnectionStrings
{
    /// <summary>
    /// Accepts either an Npgsql connection string or a postgres:// URI (what Neon and Render hand out)
    /// and returns an Npgsql connection string.
    /// </summary>
    public static string Normalize(string value)
    {
        if (!value.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) &&
            !value.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
        {
            return value;
        }

        return FromUri(value);
    }

    /// <summary>
    /// Pool and timeout settings for a small server in front of a serverless database. Anything already written in the
    /// connection string wins; these only fill the gaps.
    /// </summary>
    public static string Tune(string connectionString)
    {
        var raw = new System.Data.Common.DbConnectionStringBuilder { ConnectionString = connectionString };
        var given = raw.Keys.Cast<string>().Select(k => k.Replace(" ", "").Replace("_", "").ToLowerInvariant()).ToHashSet();
        bool Has(params string[] names) => names.Any(n => given.Contains(n));
        var b = new NpgsqlConnectionStringBuilder(connectionString);

        // Keep the pool small: a free database allows few connections, and requests wait briefly for one instead of failing.
        if (!Has("maxpoolsize", "maximumpoolsize")) b.MaxPoolSize = 20;
        // Neon suspends an idle database; waking it can take a few seconds, so allow that long to connect.
        if (!Has("timeout")) b.Timeout = 20;
        // A runaway query is cancelled rather than holding a connection (and a request) forever.
        if (!Has("commandtimeout")) b.CommandTimeout = 20;
        if (!Has("connectionidlelifetime", "idlelifetime")) b.ConnectionIdleLifetime = 30;
        // Recycle connections now and then so one that Neon has dropped is never reused.
        if (!Has("connectionlifetime", "loadbalancetimeout")) b.ConnectionLifetime = 300;
        if (!Has("keepalive")) b.KeepAlive = 30;
        // Neon's pooler (PgBouncer, transaction mode) resets sessions itself, so skip the extra reset round trip on every release.
        if (b.Host?.Contains("-pooler", StringComparison.OrdinalIgnoreCase) == true && !Has("noresetonclose")) b.NoResetOnClose = true;
        return b.ConnectionString;
    }

    private static string FromUri(string value)
    {

        var uri = new Uri(value);
        var userInfo = uri.UserInfo.Split(':', 2);
        var builder = new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.Port > 0 ? uri.Port : 5432,
            Database = uri.AbsolutePath.TrimStart('/'),
            Username = Uri.UnescapeDataString(userInfo[0]),
            Password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : null,
            SslMode = SslMode.Require,
        };

        foreach (var pair in uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var kv = pair.Split('=', 2);
            if (kv.Length == 2 && kv[0].Equals("sslmode", StringComparison.OrdinalIgnoreCase) &&
                Enum.TryParse<SslMode>(kv[1], ignoreCase: true, out var mode))
            {
                builder.SslMode = mode;
            }
        }

        return builder.ConnectionString;
    }
}
