using System.Text;
using System.Text.Json;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Zenigma.Api.Auth;
using Zenigma.Api.Community;
using Zenigma.Api.Data;
using Zenigma.Api.Games.Puzzles;
using Zenigma.Api.Games.WordGuess;
using Zenigma.Api.Streaks;
using Zenigma.Api.Leaderboards;
using Zenigma.Api.Infrastructure;
using Zenigma.Api.Sync;
using Zenigma.Api.Hints;
using Zenigma.Api.Mind;
using Zenigma.Api.Profile;
using Zenigma.Api.Store;
using Zenigma.Api.Supporters;

// Local development: read secrets from the git-ignored .env (see .env.example). Production uses real environment variables.
if (!string.Equals(Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"), "Production", StringComparison.OrdinalIgnoreCase)
    && DotEnv.Find(Directory.GetCurrentDirectory()) is { } envFile)
{
    DotEnv.Load(envFile);
}

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection(JwtOptions.Section));
var jwt = builder.Configuration.GetSection(JwtOptions.Section).Get<JwtOptions>() ?? new JwtOptions();
if (jwt.Key.Length < 32) throw new InvalidOperationException("Jwt:Key must be at least 32 characters (set Jwt__Key).");

var connection = builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("ConnectionStrings:Default is not set (set ConnectionStrings__Default).");

var tunedConnection = ConnectionStrings.Tune(ConnectionStrings.Normalize(connection));
// A pool of ready DbContexts: a request borrows one instead of building a new one (less memory churn under load).
builder.Services.AddDbContextPool<AppDbContext>(o => o.UseNpgsql(tunedConnection), poolSize: 64);
builder.Services.AddSingleton<BoardCache>();

// Request limits: a small body cap (the biggest legitimate request is a 200-event sync push) and a ceiling on open connections.
builder.WebHost.ConfigureKestrel(k =>
{
    k.Limits.MaxRequestBodySize = 8 * 1024 * 1024;
    k.Limits.MaxConcurrentConnections = 400;
    k.Limits.KeepAliveTimeout = TimeSpan.FromSeconds(60);
    k.Limits.RequestHeadersTimeout = TimeSpan.FromSeconds(15);
});
builder.Services.AddSingleton(TimeProvider.System);

builder.Services
    .AddIdentityCore<ApplicationUser>(o =>
    {
        o.Password.RequiredLength = 8;
        // Length matters more than character mix (NIST guidance): 8+ characters, no composition rules.
        o.Password.RequireNonAlphanumeric = false;
        o.Password.RequireUppercase = false;
        o.Password.RequireLowercase = false;
        o.Password.RequireDigit = false;
        o.User.RequireUniqueEmail = true;
        o.Lockout.MaxFailedAccessAttempts = 8;
        o.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(10);
        // The Flyway migration creates the version 2 schema (no passkeys table).
        o.Stores.SchemaVersion = IdentitySchemaVersions.Version2;
    })
    .AddEntityFrameworkStores<AppDbContext>();

// OWASP's current guidance for PBKDF2-HMAC-SHA512. Existing hashes stay valid and are upgraded the next time someone signs in.
builder.Services.Configure<PasswordHasherOptions>(o => o.IterationCount = 210_000);
builder.Services.AddScoped<TokenService>();
builder.Services.AddScoped<EmailCodeService>();
builder.Services.Configure<BrevoOptions>(builder.Configuration.GetSection(BrevoOptions.Section));
builder.Services.AddHttpClient<IEmailSender, BrevoEmailSender>(c => c.Timeout = TimeSpan.FromSeconds(8));
builder.Services.AddHostedService<RefreshTokenCleanup>();
builder.Services.AddHostedService<Zenigma.Api.Infrastructure.SyncEventRetention>();
builder.Services.Configure<GoogleOptions>(builder.Configuration.GetSection(GoogleOptions.Section));
builder.Services.AddHttpClient<IGoogleTokenVerifier, GoogleTokenVerifier>(c => c.Timeout = TimeSpan.FromSeconds(8));
builder.Services.AddSingleton<WordList>();
builder.Services.AddSingleton<PracticeLevels>();
builder.Services.AddSingleton<PracticeRecorder>();

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.MapInboundClaims = false;
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidIssuer = jwt.Issuer,
            ValidAudience = jwt.Audience,
            // Only the algorithm we sign with is accepted (no "alg: none", no algorithm swapping).
            ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
            RequireSignedTokens = true,
            RequireExpirationTime = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key)),
            ClockSkew = TimeSpan.FromSeconds(30),
            NameClaimType = "sub",
        };
    });
builder.Services.AddAuthorization();

// The Android app's WebView origin is https://localhost. Plain-http localhost origins are for development only.
var defaultOrigins = builder.Environment.IsDevelopment()
    ? new[] { "https://localhost", "capacitor://localhost", "http://localhost", "http://localhost:4200" }
    : new[] { "https://localhost", "capacitor://localhost" };
var origins = defaultOrigins.Concat(builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? []).ToArray();
// Browsers may remember the CORS preflight for an hour, which removes most OPTIONS requests.
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod().SetPreflightMaxAge(TimeSpan.FromHours(1))));

builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.OnRejected = (ctx, _) =>
    {
        // Tell well-behaved clients when to try again, and keep a trace of who is being turned away.
        ctx.HttpContext.Response.Headers.RetryAfter = "3";
        ctx.HttpContext.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("Security")
            .LogWarning("Security: request limited {Method} {Path} from {Ip}", ctx.HttpContext.Request.Method, ctx.HttpContext.Request.Path, ctx.HttpContext.Connection.RemoteIpAddress);
        return ValueTask.CompletedTask;
    };

    // Protection for the whole server, applied to every request except the liveness check:
    //  1. At most 48 requests are worked on at once; up to 200 more wait their turn, the rest are told to retry shortly.
    //     A small instance that tries to do everything at once slows down for everybody; queueing keeps it steady.
    //  2. Signing in or registering hashes a password, which is heavy on a small CPU, so only 3 run at a time.
    //  3. Each signed-in user (or each address, when anonymous) gets a generous per-minute allowance.
    o.GlobalLimiter = PartitionedRateLimiter.CreateChained(
        PartitionedRateLimiter.Create<HttpContext, string>(ctx => ctx.Request.Path.StartsWithSegments("/health")
            ? RateLimitPartition.GetNoLimiter("health")
            : RateLimitPartition.GetConcurrencyLimiter("all", _ => new ConcurrencyLimiterOptions
            {
                PermitLimit = 48,
                QueueLimit = 200,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
            })),
        PartitionedRateLimiter.Create<HttpContext, string>(ctx =>
        {
            var path = ctx.Request.Path;
            return path.StartsWithSegments("/auth/login") || path.StartsWithSegments("/auth/register") || path.StartsWithSegments("/auth/delete-account")
                ? RateLimitPartition.GetConcurrencyLimiter("hashing", _ => new ConcurrencyLimiterOptions { PermitLimit = 3, QueueLimit = 60, QueueProcessingOrder = QueueProcessingOrder.OldestFirst })
                : RateLimitPartition.GetNoLimiter("other");
        }),
        PartitionedRateLimiter.Create<HttpContext, string>(ctx =>
        {
            if (ctx.Request.Path.StartsWithSegments("/health")) return RateLimitPartition.GetNoLimiter("health");
            var sub = ctx.User.FindFirst("sub")?.Value;
            return sub is not null
                ? RateLimitPartition.GetSlidingWindowLimiter("u:" + sub, _ => new SlidingWindowRateLimiterOptions { PermitLimit = 400, Window = TimeSpan.FromMinutes(1), SegmentsPerWindow = 6 })
                : RateLimitPartition.GetSlidingWindowLimiter("ip:" + (ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown"), _ => new SlidingWindowRateLimiterOptions { PermitLimit = 600, Window = TimeSpan.FromMinutes(1), SegmentsPerWindow = 6 });
        }));
    o.AddPolicy("auth", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 30, Window = TimeSpan.FromMinutes(1) }));
    // Anything that sends an email: few a minute, so one address cannot be flooded.
    o.AddPolicy("mail", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 5, Window = TimeSpan.FromMinutes(1) }));
    // Circle codes are 6 characters, so guessing them is slowed right down.
    o.AddPolicy("join", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.User.FindFirst("sub")?.Value ?? ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1) }));
    o.AddPolicy("report", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1) }));
});

builder.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase);
builder.Services.AddProblemDetails();

// A request that takes longer than this is cancelled, so a stuck one cannot hold a slot (and a database connection) forever.
builder.Services.AddRequestTimeouts(o => o.DefaultPolicy = new Microsoft.AspNetCore.Http.Timeouts.RequestTimeoutPolicy { Timeout = TimeSpan.FromSeconds(30) });

// JSON compresses to a fraction of its size; bandwidth and the time on slow phone connections both drop.
builder.Services.AddResponseCompression(o =>
{
    o.EnableForHttps = true;
    o.Providers.Add<BrotliCompressionProvider>();
    o.Providers.Add<GzipCompressionProvider>();
});
builder.Services.Configure<BrotliCompressionProviderOptions>(o => o.Level = System.IO.Compression.CompressionLevel.Fastest);

var app = builder.Build();

// Render terminates TLS in front of the container, so trust its forwarded headers for the client IP.
var forwarded = new ForwardedHeadersOptions { ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto };
forwarded.KnownIPNetworks.Clear();
forwarded.KnownProxies.Clear();
app.UseForwardedHeaders(forwarded);

app.UseExceptionHandler();

// Security headers on every response. The API only returns JSON, so the content policy forbids everything else.
app.Use(async (ctx, next) =>
{
    ctx.Response.OnStarting(() =>
    {
        var h = ctx.Response.Headers;
        h.XContentTypeOptions = "nosniff";
        h["Referrer-Policy"] = "no-referrer";
        h.XFrameOptions = "DENY";
        h.ContentSecurityPolicy = "default-src 'none'; frame-ancestors 'none'";
        h["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()";
        h["Cross-Origin-Resource-Policy"] = "cross-origin";
        if (!app.Environment.IsDevelopment()) h.StrictTransportSecurity = "max-age=31536000; includeSubDomains";
        // Answers are per person, so nothing but the public community counts may be kept by a cache.
        if (!h.ContainsKey("Cache-Control")) h.CacheControl = "no-store";
        return Task.CompletedTask;
    });
    await next();
});

app.UseResponseCompression();
app.UseCors();
// Authentication comes first so the limiter can count requests per user.
app.UseAuthentication();
app.UseRateLimiter();
app.UseRequestTimeouts();
app.UseAuthorization();
app.UseMiddleware<Zenigma.Api.Infrastructure.ConditionalGetMiddleware>();

// Liveness only. Nothing in the apps calls this on a timer, so the sleeping free-tier services stay asleep.
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

// Readiness check for you, not for the apps: it touches the database (and so wakes Neon), so nothing should poll it on a timer.
app.MapGet("/health/db", async (AppDbContext db, CancellationToken ct) =>
{
    using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
    timeout.CancelAfter(TimeSpan.FromSeconds(10));
    try
    {
        var started = TimeProvider.System.GetTimestamp();
        await db.Database.ExecuteSqlRawAsync("SELECT 1", timeout.Token);
        return Results.Ok(new { status = "ok", dbMs = (int)TimeProvider.System.GetElapsedTime(started).TotalMilliseconds });
    }
    catch (Exception e) when (e is not OperationCanceledException || !ct.IsCancellationRequested)
    {
        return Results.Json(new { status = "database unreachable" }, statusCode: StatusCodes.Status503ServiceUnavailable);
    }
});

// The server's clock decides which daily puzzle is current; clients never trust their own.
app.MapGet("/time", (TimeProvider clock) =>
{
    var now = clock.GetUtcNow();
    return Results.Ok(new { utcNow = now, istDate = IstClock.Today(now).ToString("yyyy-MM-dd"), nextRolloverUtc = IstClock.NextRollover(now).ToUniversalTime() });
});

app.MapAuth();
app.MapSync();
app.MapProfile();
app.MapHints();
app.MapStore();
app.MapMind();
app.MapDaily();
app.MapPuzzleDaily();
app.MapLeaderboards();
app.MapStats();
app.MapCircles();
app.MapCommunity();
app.MapSupporters();
app.MapSupporterWebhooks();
app.MapErrorReports();

app.Run();

public partial class Program;
