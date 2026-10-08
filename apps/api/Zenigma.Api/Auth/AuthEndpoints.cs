using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Zenigma.Api.Data;

namespace Zenigma.Api.Auth;

public record RegisterRequest(string? Email, string? Password, string? DisplayName, Guid? DeviceId);
public record LoginRequest(string? Email, string? Password, Guid? DeviceId);
public record RefreshRequest(string? RefreshToken, Guid? DeviceId);
public record LogoutRequest(string? RefreshToken);

public static class AuthEndpoints
{
    public static void MapAuth(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/auth").RequireRateLimiting("auth");

        group.MapPost("/register", async (
            RegisterRequest request,
            UserManager<ApplicationUser> users,
            TokenService tokens,
            CancellationToken ct) =>
        {
            var email = request.Email?.Trim() ?? "";
            if (email.Length is 0 or > 256 || !new EmailAddressAttribute().IsValid(email))
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["email"] = ["Enter a valid email address."] });

            var displayName = string.IsNullOrWhiteSpace(request.DisplayName) ? null : request.DisplayName.Trim();
            if (displayName is { Length: > 64 })
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["displayName"] = ["Keep the name under 64 characters."] });

            var user = new ApplicationUser { UserName = email, Email = email, DisplayName = displayName };
            var created = await users.CreateAsync(user, request.Password ?? "");
            if (!created.Succeeded)
            {
                // Duplicate emails get the same shape of answer as any other validation problem.
                var errors = created.Errors
                    .GroupBy(e => e.Code.Contains("Password", StringComparison.Ordinal) ? "password" : "email")
                    .ToDictionary(g => g.Key, g => g.Select(e => e.Description).ToArray());
                return Results.ValidationProblem(errors);
            }

            return Results.Ok(await tokens.IssueAsync(user, request.DeviceId, ct));
        });

        group.MapPost("/login", async (
            LoginRequest request,
            UserManager<ApplicationUser> users,
            TokenService tokens,
            CancellationToken ct) =>
        {
            var invalid = Results.Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Wrong email or password.");

            var user = string.IsNullOrWhiteSpace(request.Email) ? null : await users.FindByEmailAsync(request.Email.Trim());
            if (user is null || string.IsNullOrEmpty(request.Password)) return invalid;
            if (await users.IsLockedOutAsync(user))
                return Results.Problem(statusCode: StatusCodes.Status429TooManyRequests, title: "Too many attempts. Try again later.");

            if (!await users.CheckPasswordAsync(user, request.Password))
            {
                await users.AccessFailedAsync(user);
                return invalid;
            }

            await users.ResetAccessFailedCountAsync(user);
            return Results.Ok(await tokens.IssueAsync(user, request.DeviceId, ct));
        });

        group.MapPost("/refresh", async (
            RefreshRequest request,
            UserManager<ApplicationUser> users,
            TokenService tokens,
            CancellationToken ct) =>
        {
            if (string.IsNullOrEmpty(request.RefreshToken)) return Results.Unauthorized();

            var userId = await tokens.RotateAsync(request.RefreshToken, ct);
            var user = userId is null ? null : await users.FindByIdAsync(userId);
            if (user is null) return Results.Unauthorized();

            return Results.Ok(await tokens.IssueAsync(user, request.DeviceId, ct));
        });

        group.MapPost("/logout", async ([FromBody] LogoutRequest request, TokenService tokens, CancellationToken ct) =>
        {
            if (!string.IsNullOrEmpty(request.RefreshToken)) await tokens.RevokeAsync(request.RefreshToken, ct);
            return Results.NoContent();
        });

        group.MapGet("/me", async (ClaimsPrincipal principal, UserManager<ApplicationUser> users) =>
        {
            var user = await users.FindByIdAsync(UserIds.Get(principal));
            return user is null
                ? Results.Unauthorized()
                : Results.Ok(new AuthUserDto(user.Id, user.Email ?? "", user.DisplayName));
        }).RequireAuthorization();
    }
}
