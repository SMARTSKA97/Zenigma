using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Zenigma.Api.Tests;

public class EdgeGuardTests
{
    private static WebApplicationFactory<Program> Make(string? secret) => new ApiFactory().WithWebHostBuilder(b =>
    {
        if (secret is not null) b.UseSetting("Edge:Secret", secret);
    });

    [DbFact]
    public async Task Without_a_secret_configured_nothing_changes()
    {
        using var f = Make(null);
        var r = await f.CreateClient().GetAsync("/health");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
    }

    [DbFact]
    public async Task With_a_secret_requests_without_it_are_refused_but_health_stays_open()
    {
        using var f = Make("s3cret-value");
        var c = f.CreateClient();
        Assert.Equal(HttpStatusCode.OK, (await c.GetAsync("/health")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await c.GetAsync("/time")).StatusCode);
        var wrong = new HttpRequestMessage(HttpMethod.Get, "/time");
        wrong.Headers.Add("X-Zenigma-Edge", "nope");
        Assert.Equal(HttpStatusCode.Forbidden, (await c.SendAsync(wrong)).StatusCode);
    }

    [DbFact]
    public async Task With_the_right_secret_the_request_goes_through()
    {
        using var f = Make("s3cret-value");
        var req = new HttpRequestMessage(HttpMethod.Get, "/time");
        req.Headers.Add("X-Zenigma-Edge", "s3cret-value");
        Assert.NotEqual(HttpStatusCode.Forbidden, (await f.CreateClient().SendAsync(req)).StatusCode);
    }
}
