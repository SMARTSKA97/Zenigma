using System.Net.Http.Json;
using Microsoft.Extensions.Options;

namespace Zenigma.Api.Auth;

public class BrevoOptions
{
    public const string Section = "Brevo";

    /// <summary>A Brevo API key (Brevo__ApiKey). Empty means no email is sent (codes are only logged as "not sent").</summary>
    public string ApiKey { get; set; } = "";

    /// <summary>A sender address verified in Brevo (Brevo__SenderEmail).</summary>
    public string SenderEmail { get; set; } = "";

    public string SenderName { get; set; } = "Zenigma";
}

public interface IEmailSender
{
    /// <summary>True when email is set up, so the sign-in screens can offer "forgot password".</summary>
    bool Enabled { get; }

    /// <summary>Sends one message. Returns false if it could not be sent (never throws for a delivery problem).</summary>
    Task<bool> SendAsync(string to, string subject, string text, string html, CancellationToken ct);
}

/// <summary>Sends transactional email through Brevo's HTTP API (https://developers.brevo.com).</summary>
public class BrevoEmailSender(HttpClient http, IOptions<BrevoOptions> options, ILogger<BrevoEmailSender> log) : IEmailSender
{
    public bool Enabled => options.Value.ApiKey.Length > 0 && options.Value.SenderEmail.Length > 0;

    public async Task<bool> SendAsync(string to, string subject, string text, string html, CancellationToken ct)
    {
        if (!Enabled) return false;
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.brevo.com/v3/smtp/email")
            {
                Content = JsonContent.Create(new
                {
                    sender = new { name = options.Value.SenderName, email = options.Value.SenderEmail },
                    to = new[] { new { email = to } },
                    subject,
                    textContent = text,
                    htmlContent = html,
                }),
            };
            request.Headers.Add("api-key", options.Value.ApiKey);
            using var response = await http.SendAsync(request, ct);
            if (response.IsSuccessStatusCode) return true;
            log.LogWarning("Brevo refused an email: {Status}", (int)response.StatusCode);
            return false;
        }
        catch (Exception e) when (e is HttpRequestException or TaskCanceledException)
        {
            log.LogWarning("Brevo could not be reached: {Reason}", e.Message);
            return false;
        }
    }
}
