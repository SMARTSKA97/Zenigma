using System.Text;
using System.Text.Json;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Zenigma.Api.Auth;
using Zenigma.Api.Data;
using Zenigma.Api.Infrastructure;
using Zenigma.Api.Sync;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection(JwtOptions.Section));
var jwt = builder.Configuration.GetSection(JwtOptions.Section).Get<JwtOptions>() ?? new JwtOptions();
if (jwt.Key.Length < 32) throw new InvalidOperationException("Jwt:Key must be at least 32 characters (set Jwt__Key).");

var connection = builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("ConnectionStrings:Default is not set (set ConnectionStrings__Default).");

builder.Services.AddDbContext<AppDbContext>(o => o.UseNpgsql(ConnectionStrings.Normalize(connection)));
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

builder.Services.AddScoped<TokenService>();

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.MapInboundClaims = false;
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidIssuer = jwt.Issuer,
            ValidAudience = jwt.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key)),
            ClockSkew = TimeSpan.FromSeconds(30),
            NameClaimType = "sub",
        };
    });
builder.Services.AddAuthorization();

var defaultOrigins = new[] { "https://localhost", "capacitor://localhost", "http://localhost", "http://localhost:4200" };
var origins = defaultOrigins.Concat(builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? []).ToArray();
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod()));

builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.AddPolicy("auth", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 30, Window = TimeSpan.FromMinutes(1) }));
});

builder.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase);
builder.Services.AddProblemDetails();

var app = builder.Build();

// Render terminates TLS in front of the container, so trust its forwarded headers for the client IP.
var forwarded = new ForwardedHeadersOptions { ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto };
forwarded.KnownIPNetworks.Clear();
forwarded.KnownProxies.Clear();
app.UseForwardedHeaders(forwarded);

app.UseExceptionHandler();
app.UseCors();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

// Liveness only. Nothing in the apps calls this on a timer, so the sleeping free-tier services stay asleep.
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

// The server's clock decides which daily puzzle is current; clients never trust their own.
app.MapGet("/time", (TimeProvider clock) =>
{
    var now = clock.GetUtcNow();
    return Results.Ok(new { utcNow = now, istDate = IstClock.Today(now).ToString("yyyy-MM-dd"), nextRolloverUtc = IstClock.NextRollover(now).ToUniversalTime() });
});

app.MapAuth();
app.MapSync();

app.Run();

public partial class Program;
