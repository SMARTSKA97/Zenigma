namespace Zenigma.Api.Auth;

/// <summary>Turns a user agent into a short name a person recognises: "iPhone · Safari", "Android · Chrome", "Windows · Edge".</summary>
public static class DeviceNames
{
    public static string From(string? ua)
    {
        if (string.IsNullOrWhiteSpace(ua)) return "Unknown device";
        var os = Has(ua, "iPhone") ? "iPhone" : Has(ua, "iPad") ? "iPad" : Has(ua, "Android") ? "Android" : Has(ua, "Windows") ? "Windows"
            : Has(ua, "Mac OS X") || Has(ua, "Macintosh") ? "Mac" : Has(ua, "CrOS") ? "Chromebook" : Has(ua, "Linux") ? "Linux" : "Device";
        // An installed Android app runs in a WebView ("; wv)"), which is the app itself rather than a browser.
        var app = Has(ua, "; wv)") ? "App" : null;
        var browser = app ?? (Has(ua, "Edg/") || Has(ua, "EdgA/") || Has(ua, "EdgiOS/") ? "Edge" : Has(ua, "OPR/") ? "Opera" : Has(ua, "SamsungBrowser") ? "Samsung Internet"
            : Has(ua, "Firefox/") || Has(ua, "FxiOS/") ? "Firefox" : Has(ua, "CriOS/") || Has(ua, "Chrome/") ? "Chrome" : Has(ua, "Safari/") ? "Safari" : null);
        var name = browser is null ? os : $"{os} · {browser}";
        return name.Length <= 80 ? name : name[..80];
    }

    private static bool Has(string s, string part) => s.Contains(part, StringComparison.OrdinalIgnoreCase);
}
