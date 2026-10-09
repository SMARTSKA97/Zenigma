using System.Security.Claims;

namespace Zenigma.Api.Auth;

public static class UserIds
{
    /// <summary>The signed-in user's id, whether or not the JWT handler remapped the "sub" claim.</summary>
    public static string Get(ClaimsPrincipal principal) =>
        principal.FindFirstValue("sub") ?? principal.FindFirstValue(ClaimTypes.NameIdentifier) ?? "";
}
