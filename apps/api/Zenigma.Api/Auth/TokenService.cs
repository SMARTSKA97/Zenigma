using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Zenigma.Api.Data;

namespace Zenigma.Api.Auth;

public record AuthUserDto(string Id, string Email, string? DisplayName);

public record AuthSessionDto(string AccessToken, DateTimeOffset AccessTokenExpiresAt, string RefreshToken, AuthUserDto User);

public class TokenService(AppDbContext db, IOptions<JwtOptions> options, TimeProvider clock, ILogger<TokenService> logger)
{
    private readonly JwtOptions _options = options.Value;

    public static string Hash(string token) =>
        Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    public static string NewRefreshToken() => WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));

    public async Task<AuthSessionDto> IssueAsync(ApplicationUser user, Guid? deviceId, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var expires = now.AddMinutes(_options.AccessTokenMinutes);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id),
            new(JwtRegisteredClaimNames.Email, user.Email ?? ""),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")),
        };
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.Key));
        var jwt = new JwtSecurityToken(
            _options.Issuer,
            _options.Audience,
            claims,
            notBefore: now.UtcDateTime,
            expires: expires.UtcDateTime,
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));
        var accessToken = new JwtSecurityTokenHandler().WriteToken(jwt);

        var refresh = NewRefreshToken();
        db.RefreshTokens.Add(new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            DeviceId = deviceId,
            TokenHash = Hash(refresh),
            CreatedAt = now,
            ExpiresAt = now.AddDays(_options.RefreshTokenDays),
        });
        await db.SaveChangesAsync(ct);

        return new AuthSessionDto(accessToken, expires, refresh, new AuthUserDto(user.Id, user.Email ?? "", user.DisplayName));
    }

    /// <summary>How long after a refresh token was used a second use is treated as a race (two tabs refreshing at once) and not as theft.</summary>
    private static readonly TimeSpan ReuseGrace = TimeSpan.FromSeconds(60);

    /// <summary>
    /// Validates and rotates a refresh token. Returns the owning user id, or null if it is unknown, expired, revoked or already used.
    /// A token that was used a while ago and comes back is a sign it was copied, so every session of that user is ended.
    /// </summary>
    public async Task<string?> RotateAsync(string refreshToken, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var hash = Hash(refreshToken);
        var stored = await db.RefreshTokens.AsNoTracking().FirstOrDefaultAsync(t => t.TokenHash == hash, ct);
        if (stored is null) return null;

        if (stored.RevokedAt is { } revokedAt)
        {
            if (now - revokedAt > ReuseGrace)
            {
                await RevokeAllAsync(stored.UserId, ct);
                logger.LogWarning("Security: a used refresh token came back for user {UserId}; all of that user's sessions were ended.", stored.UserId);
            }
            return null;
        }

        if (stored.ExpiresAt <= now) return null;

        // Only one request can win the swap, so a token cannot be used twice at the same moment.
        var won = await db.RefreshTokens.Where(t => t.Id == stored.Id && t.RevokedAt == null)
            .ExecuteUpdateAsync(set => set.SetProperty(t => t.RevokedAt, now), ct);
        return won == 1 ? stored.UserId : null;
    }

    /// <summary>Ends every session of a user (after a password change, a Google link to an unverified account, or a suspected stolen token).</summary>
    public async Task RevokeAllAsync(string userId, CancellationToken ct, string? exceptRefreshToken = null)
    {
        var now = clock.GetUtcNow();
        var keep = exceptRefreshToken is { Length: > 0 } ? Hash(exceptRefreshToken) : null;
        await db.RefreshTokens.Where(t => t.UserId == userId && t.RevokedAt == null && t.TokenHash != keep)
            .ExecuteUpdateAsync(set => set.SetProperty(t => t.RevokedAt, now), ct);
    }

    public async Task RevokeAsync(string refreshToken, CancellationToken ct)
    {
        var hash = Hash(refreshToken);
        var stored = await db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash && t.RevokedAt == null, ct);
        if (stored is null) return;
        stored.RevokedAt = clock.GetUtcNow();
        await db.SaveChangesAsync(ct);
    }
}
