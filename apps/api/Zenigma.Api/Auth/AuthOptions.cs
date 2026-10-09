namespace Zenigma.Api.Auth;

public class JwtOptions
{
    public const string Section = "Jwt";

    public string Issuer { get; set; } = "zenigma-api";
    public string Audience { get; set; } = "zenigma-app";

    /// <summary>HMAC signing key, at least 32 characters. Set via the Jwt__Key environment variable.</summary>
    public string Key { get; set; } = "";

    public int AccessTokenMinutes { get; set; } = 15;
    public int RefreshTokenDays { get; set; } = 60;
}
