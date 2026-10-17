using System.Security.Cryptography;
using Microsoft.Extensions.Primitives;

namespace Zenigma.Api.Infrastructure;

/// <summary>
/// ETag for the read-only screens the app asks for again and again (boards, stats, the daily hub). The answer is hashed;
/// when the app already holds that exact answer it gets a bodyless 304 instead of the JSON again. The database work
/// is unchanged, but the bytes sent (and the free tier's bandwidth) shrink. Per player: it is never shared by a cache.
/// </summary>
public sealed class ConditionalGetMiddleware(RequestDelegate next)
{
    private static bool Applies(HttpRequest r) =>
        HttpMethods.IsGet(r.Method)
        && (r.Path.StartsWithSegments("/leaderboards") || r.Path.StartsWithSegments("/stats") || r.Path == "/daily");

    public async Task InvokeAsync(HttpContext ctx)
    {
        if (!Applies(ctx.Request))
        {
            await next(ctx);
            return;
        }

        var original = ctx.Response.Body;
        await using var buffer = new MemoryStream();
        ctx.Response.Body = buffer;
        try
        {
            await next(ctx);
        }
        finally
        {
            ctx.Response.Body = original;
        }

        if (ctx.Response.StatusCode == StatusCodes.Status200OK && buffer.Length > 0)
        {
            var hash = SHA256.HashData(buffer.GetBuffer().AsSpan(0, (int)buffer.Length));
            var etag = $"\"{Convert.ToHexString(hash, 0, 12)}\"";
            ctx.Response.Headers.ETag = etag;
            ctx.Response.Headers.CacheControl = "private, max-age=0, must-revalidate";
            ctx.Response.Headers.Vary = "Authorization";
            if (Matches(ctx.Request.Headers.IfNoneMatch, etag))
            {
                ctx.Response.StatusCode = StatusCodes.Status304NotModified;
                ctx.Response.ContentLength = null;
                ctx.Response.ContentType = null;
                return;
            }
        }

        buffer.Position = 0;
        await buffer.CopyToAsync(original, ctx.RequestAborted);
    }

    public static bool Matches(StringValues header, string etag)
    {
        foreach (var value in header)
            foreach (var part in (value ?? "").Split(','))
            {
                var tag = part.Trim();
                if (tag == "*" || (tag.StartsWith("W/", StringComparison.Ordinal) ? tag[2..] : tag) == etag) return true;
            }
        return false;
    }
}
