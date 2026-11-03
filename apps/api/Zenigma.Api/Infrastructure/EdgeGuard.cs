using System.Net;
using System.Security.Cryptography;
using System.Text;

namespace Zenigma.Api.Infrastructure;

/// <summary>
/// Makes Cloudflare the only way in. When <c>Edge:Secret</c> is set, every request except the liveness check must carry the header
/// <c>X-Zenigma-Edge</c> with that value (Cloudflare adds it with a Transform Rule), so anyone going straight to the Render address
/// is refused before any work is done. Requests that pass also tell us the real visitor address in <c>CF-Connecting-IP</c>, which
/// is trusted only because the secret proves the request came through Cloudflare. With no secret set nothing changes.
/// </summary>
public sealed class EdgeGuard(RequestDelegate next, IConfiguration config, ILogger<EdgeGuard> log)
{
    public const string Header = "X-Zenigma-Edge";
    private readonly byte[] _secret = Encoding.UTF8.GetBytes(config["Edge:Secret"] ?? "");

    public Task InvokeAsync(HttpContext ctx)
    {
        if (_secret.Length == 0 || ctx.Request.Path.StartsWithSegments("/health")) return next(ctx);
        var sent = Encoding.UTF8.GetBytes(ctx.Request.Headers[Header].ToString());
        if (!CryptographicOperations.FixedTimeEquals(sent, _secret) || sent.Length != _secret.Length)
        {
            log.LogWarning("Security: request without the edge secret {Method} {Path} from {Ip}", ctx.Request.Method, ctx.Request.Path, ctx.Connection.RemoteIpAddress);
            ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
            return Task.CompletedTask;
        }
        if (IPAddress.TryParse(ctx.Request.Headers["CF-Connecting-IP"].ToString(), out var visitor)) ctx.Connection.RemoteIpAddress = visitor;
        return next(ctx);
    }
}
