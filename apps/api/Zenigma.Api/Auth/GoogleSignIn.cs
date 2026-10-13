using System.Text.Json;

namespace Zenigma.Api.Auth;

/// <summary>What Google tells us about a verified sign-in.</summary>
public record GoogleIdentity(string Subject, string Email, bool EmailVerified, string? Name);

public class GoogleOptions
{
    public const string Section = "Google";

    /// <summary>The OAuth client id of the web app (Google__ClientId). Empty means Google sign-in is not set up.</summary>
    public string ClientId { get; set; } = "";
}

public interface IGoogleTokenVerifier
{
    /// <summary>Checks an ID token from Google Identity Services. Null when it is not valid for this app.</summary>
    Task<GoogleIdentity?> VerifyAsync(string idToken, CancellationToken ct);
}

/// <summary>Asks Google to check the token (the tokeninfo endpoint validates the signature and expiry), then checks it was issued for this app.</summary>
public class GoogleTokenVerifier(HttpClient http, Microsoft.Extensions.Options.IOptions<GoogleOptions> options) : IGoogleTokenVerifier
{
    public async Task<GoogleIdentity?> VerifyAsync(string idToken, CancellationToken ct)
    {
        var clientId = options.Value.ClientId;
        if (clientId.Length == 0 || idToken.Length is 0 or > 4096) return null;
        try
        {
            using var response = await http.GetAsync($"https://oauth2.googleapis.com/tokeninfo?id_token={Uri.EscapeDataString(idToken)}", ct);
            if (!response.IsSuccessStatusCode) return null;
            using var doc = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
            var root = doc.RootElement;
            string? Text(string name) => root.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
            if (Text("aud") != clientId) return null;
            var issuer = Text("iss");
            if (issuer is not ("accounts.google.com" or "https://accounts.google.com")) return null;
            var sub = Text("sub");
            var email = Text("email");
            if (string.IsNullOrEmpty(sub) || string.IsNullOrEmpty(email)) return null;
            return new GoogleIdentity(sub, email, Text("email_verified") == "true", Text("name"));
        }
        catch (Exception e) when (e is HttpRequestException or JsonException or TaskCanceledException)
        {
            return null;
        }
    }
}
