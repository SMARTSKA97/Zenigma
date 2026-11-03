using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace Zenigma.Api.Tests;

public class DeviceTests : IClassFixture<ApiFactory>
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private static readonly string Password = Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(12));
    private readonly ApiFactory _factory;

    public DeviceTests(ApiFactory factory) => _factory = factory;

    private static async Task<JsonElement> Body(HttpResponseMessage r) => await r.Content.ReadFromJsonAsync<JsonElement>(Json);

    [DbFact]
    public async Task A_free_account_holds_one_device_and_a_second_sign_in_must_pick_one_to_remove()
    {
        var client = _factory.CreateClient();
        var email = $"{Guid.NewGuid():N}@example.com";
        var phone = Guid.NewGuid();
        var laptop = Guid.NewGuid();

        client.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.2 Mobile/15E148 Safari/604.1");
        var reg = await client.PostAsJsonAsync("/auth/register", new { email, password = Password, displayName = "Tester", deviceId = phone });
        Assert.Equal(HttpStatusCode.OK, reg.StatusCode);
        var first = await Body(reg);

        // A second device is turned away, with the list of the one it could replace.
        var denied = await client.PostAsJsonAsync("/auth/login", new { email, password = Password, deviceId = laptop });
        Assert.Equal(HttpStatusCode.Conflict, denied.StatusCode);
        var info = await Body(denied);
        Assert.Equal("device-limit", info.GetProperty("code").GetString());
        Assert.Equal(1, info.GetProperty("limit").GetInt32());
        Assert.Equal("iPhone · Safari", info.GetProperty("devices")[0].GetProperty("name").GetString());

        // Replacing the phone lets the laptop in and ends the phone's session for good.
        var ok = await client.PostAsJsonAsync("/auth/login", new { email, password = Password, deviceId = laptop, replaceDeviceId = phone });
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        var gone = await client.PostAsJsonAsync("/auth/refresh", new { refreshToken = first.GetProperty("refreshToken").GetString(), deviceId = phone });
        Assert.Equal(HttpStatusCode.Unauthorized, gone.StatusCode);

        // The laptop's own session was not caught up in it (a signed-out device coming back is not treated as theft).
        var session = await Body(ok);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", session.GetProperty("accessToken").GetString());
        var list = await Body(await client.GetAsync($"/auth/devices?current={laptop}"));
        Assert.Single(list.GetProperty("devices").EnumerateArray());
        Assert.True(list.GetProperty("devices")[0].GetProperty("current").GetBoolean());

        // Signing out everywhere leaves nothing.
        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsync("/auth/devices/signout-all", null)).StatusCode);
        var after = await client.PostAsJsonAsync("/auth/refresh", new { refreshToken = session.GetProperty("refreshToken").GetString(), deviceId = laptop });
        Assert.Equal(HttpStatusCode.Unauthorized, after.StatusCode);
    }
}

public class DeviceNameTests
{
    [Theory]
    [InlineData("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36", "Android · Chrome")]
    [InlineData("Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 Version/4.0 Chrome/130.0 Mobile Safari/537.36", "Android · App")]
    [InlineData("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0", "Windows · Edge")]
    [InlineData("", "Unknown device")]
    public void Names_are_short_and_readable(string ua, string expected) => Assert.Equal(expected, Auth.DeviceNames.From(ua));
}
