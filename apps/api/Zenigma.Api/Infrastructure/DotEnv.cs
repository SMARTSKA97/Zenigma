namespace Zenigma.Api.Infrastructure;

/// <summary>
/// Loads a git-ignored <c>.env</c> file into environment variables for local development, so secrets never live in
/// source files. Variables that are already set win, and blank values are skipped (they are placeholders).
/// </summary>
public static class DotEnv
{
    /// <summary>Parses one line. Returns null for blanks, comments and lines without a value.</summary>
    public static (string Key, string Value)? Parse(string line)
    {
        var text = line.Trim();
        if (text.Length == 0 || text.StartsWith('#')) return null;
        if (text.StartsWith("export ", StringComparison.Ordinal)) text = text[7..].TrimStart();

        var eq = text.IndexOf('=');
        if (eq <= 0) return null;

        var key = text[..eq].Trim();
        var value = text[(eq + 1)..].Trim();

        if (value.Length >= 2 && (value[0] == '"' || value[0] == '\'') && value[^1] == value[0])
        {
            value = value[1..^1];
        }
        else
        {
            var comment = value.IndexOf(" #", StringComparison.Ordinal);
            if (comment >= 0) value = value[..comment].TrimEnd();
        }

        return value.Length == 0 ? null : (key, value);
    }

    public static void Load(string path)
    {
        foreach (var line in File.ReadAllLines(path))
        {
            if (Parse(line) is not var (key, value)) continue;
            if (Environment.GetEnvironmentVariable(key) is null) Environment.SetEnvironmentVariable(key, value);
        }
    }

    /// <summary>Finds the nearest .env, looking in the start folder and then each parent folder.</summary>
    public static string? Find(string startDirectory)
    {
        for (var dir = new DirectoryInfo(startDirectory); dir is not null; dir = dir.Parent)
        {
            var candidate = Path.Combine(dir.FullName, ".env");
            if (File.Exists(candidate)) return candidate;
        }

        return null;
    }
}
