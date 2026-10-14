namespace Zenigma.Api.Infrastructure;

public record ErrorReportRequest(string? Message, string? Stack, string? Route, string? Version, string? Platform);

/// <summary>
/// A tiny crash report intake: the app sends what went wrong (message, a trimmed stack, the screen and the app version) and
/// it is written to the API log. No account, no device id, no third party, nothing is stored in the database.
/// </summary>
public static class ErrorReportEndpoints
{
    private static string Clip(string? value, int max) =>
        string.IsNullOrWhiteSpace(value) ? "" : new string(value.Where(c => !char.IsControl(c) || c == ' ').Take(max).ToArray());

    public static void MapErrorReports(this IEndpointRouteBuilder app)
    {
        app.MapPost("/telemetry/error", (ErrorReportRequest request, ILoggerFactory loggers) =>
        {
            var log = loggers.CreateLogger("ClientError");
            log.LogWarning(
                "Client error v{Version} on {Platform} at {Route}: {Message} | {Stack}",
                Clip(request.Version, 20), Clip(request.Platform, 20), Clip(request.Route, 100), Clip(request.Message, 300), Clip(request.Stack, 800).Replace('\n', ' '));
            return Results.NoContent();
        }).RequireRateLimiting("report");
    }
}
