using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Zenigma.Api.Auth;

namespace Zenigma.Api.Tests;

/// <summary>Collects the emails the API would send.</summary>
public sealed class FakeMail : IEmailSender
{
    public List<(string To, string Subject, string Text)> Sent { get; } = [];
    public bool Enabled => true;

    public Task<bool> SendAsync(string to, string subject, string text, string html, CancellationToken ct)
    {
        lock (Sent) Sent.Add((to, subject, text));
        return Task.FromResult(true);
    }

    public string LastCode(string to) => Regex.Match(Sent.Last(m => m.To == to).Text, @"\b\d{6}\b").Value;
}

public class MailTests : IClassFixture<ApiFactory>
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private static readonly string Password = Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(12));
    private const string NewPassword = "a-brand-new-password-1";
    private readonly ApiFactory _factory;

    public MailTests(ApiFactory factory) => _factory = factory;

    private record Session(string AccessToken, string RefreshToken, JsonElement User);

    // Each test gets its own host, so the rate limits of one test never leak into another.
    private (WebApplicationFactory<Program> Factory, FakeMail Mail) Host()
    {
        var mail = new FakeMail();
        return (_factory.WithWebHostBuilder(b => b.ConfigureServices(s => s.AddSingleton<IEmailSender>(mail))), mail);
    }

    private static async Task<(HttpClient Client, string Email, Session Session)> RegisterAsync(WebApplicationFactory<Program> factory)
    {
        var client = factory.CreateClient();
        var email = $"{Guid.NewGuid():N}@example.com";
        var response = await client.PostAsJsonAsync("/auth/register", new { email, password = Password, displayName = "Mailer", deviceId = Guid.NewGuid() });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var session = (await response.Content.ReadFromJsonAsync<Session>(Json))!;
        return (client, email, session);
    }

    [DbFact]
    public async Task Forgotten_password_is_reset_with_the_emailed_code_and_old_sessions_end()
    {
        var (factory, mail) = Host();
        var (client, email, first) = await RegisterAsync(factory);

        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/auth/forgot", new { email })).StatusCode);
        var code = mail.LastCode(email);

        // A wrong code is refused; the right one with a weak password is refused without using the code up.
        var wrong = await client.PostAsJsonAsync("/auth/reset", new { email, code = code == "000000" ? "111111" : "000000", newPassword = NewPassword });
        Assert.Equal(HttpStatusCode.BadRequest, wrong.StatusCode);
        var weak = await client.PostAsJsonAsync("/auth/reset", new { email, code, newPassword = "short" });
        Assert.Equal(HttpStatusCode.BadRequest, weak.StatusCode);

        var reset = await client.PostAsJsonAsync("/auth/reset", new { email, code, newPassword = NewPassword, deviceId = Guid.NewGuid() });
        Assert.Equal(HttpStatusCode.OK, reset.StatusCode);
        var second = (await reset.Content.ReadFromJsonAsync<Session>(Json))!;
        Assert.True(second.User.GetProperty("emailVerified").GetBoolean());

        // The old password and the old session are gone; the new password works; the code cannot be used twice.
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/auth/login", new { email, password = Password })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/auth/login", new { email, password = NewPassword })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/auth/refresh", new { refreshToken = first.RefreshToken })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/auth/reset", new { email, code, newPassword = NewPassword })).StatusCode);
    }

    [DbFact]
    public async Task Forgot_password_answers_the_same_for_unknown_addresses_and_sends_nothing()
    {
        var (factory, mail) = Host();
        var client = factory.CreateClient();
        var response = await client.PostAsJsonAsync("/auth/forgot", new { email = $"{Guid.NewGuid():N}@example.com" });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Empty(mail.Sent);
    }

    [DbFact]
    public async Task A_reset_code_locks_after_five_wrong_tries()
    {
        var (factory, mail) = Host();
        var (client, email, _) = await RegisterAsync(factory);
        await client.PostAsJsonAsync("/auth/forgot", new { email });
        var code = mail.LastCode(email);
        var guess = code == "123456" ? "654321" : "123456";

        for (var i = 0; i < 5; i++)
            Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/auth/reset", new { email, code = guess, newPassword = NewPassword })).StatusCode);
        // Even the right code no longer works.
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/auth/reset", new { email, code, newPassword = NewPassword })).StatusCode);
    }

    [DbFact]
    public async Task Codes_are_not_sent_again_within_a_minute()
    {
        var (factory, mail) = Host();
        var (client, email, _) = await RegisterAsync(factory);
        await client.PostAsJsonAsync("/auth/forgot", new { email });
        await client.PostAsJsonAsync("/auth/forgot", new { email });
        Assert.Single(mail.Sent);
    }

    [DbFact]
    public async Task Email_is_confirmed_with_the_emailed_code()
    {
        var (factory, mail) = Host();
        var (client, email, session) = await RegisterAsync(factory);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", session.AccessToken);
        Assert.False(session.User.GetProperty("emailVerified").GetBoolean());

        Assert.Equal(HttpStatusCode.OK, (await client.PostAsync("/auth/verify/send", null)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/auth/verify", new { code = "000000" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/auth/verify", new { code = mail.LastCode(email) })).StatusCode);

        var me = await client.GetFromJsonAsync<JsonElement>("/auth/me", Json);
        Assert.True(me.GetProperty("emailVerified").GetBoolean());
    }

    [DbFact]
    public async Task When_the_daily_email_budget_is_used_up_asking_for_a_code_says_so()
    {
        var mail = new FakeMail();
        var factory = _factory.WithWebHostBuilder(b =>
        {
            b.UseSetting("Email:DailyBudget", "0");
            b.ConfigureServices(s => s.AddSingleton<IEmailSender>(mail));
        });
        var (client, email, _) = await RegisterAsync(factory);

        var forgot = await client.PostAsJsonAsync("/auth/forgot", new { email });
        Assert.Equal(HttpStatusCode.TooManyRequests, forgot.StatusCode);
        // Same answer for an address that has no account, so the budget message reveals nothing about accounts.
        var unknown = await client.PostAsJsonAsync("/auth/forgot", new { email = "nobody@example.com" });
        Assert.Equal(HttpStatusCode.TooManyRequests, unknown.StatusCode);
        Assert.Empty(mail.Sent);
    }
}
