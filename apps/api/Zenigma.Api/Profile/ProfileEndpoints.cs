using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Zenigma.Api.Auth;
using Zenigma.Api.Data;

namespace Zenigma.Api.Profile;

public record ProviderDto(string Name, bool Linked);
public record ProfileDto(
    string Email,
    string? DisplayName,
    bool HasPassword,
    List<string> Providers,
    string? AgeGroup,
    string? Gender,
    bool ShareCohort,
    bool HideName);
public record UpdateProfileRequest(string? DisplayName, string? AgeGroup, string? Gender, bool? ShareCohort, bool? HideName, bool? ClearAgeGroup, bool? ClearGender);
public record SetPasswordRequest(string? CurrentPassword, string? NewPassword);
public record GoogleTokenRequest(string? IdToken);

public static class ProfileEndpoints
{
    public static readonly string[] AgeGroups = ["18-24", "25-34", "35-44", "45-54", "55+"];
    public static readonly string[] Genders = ["female", "male", "other"];

    public static void MapProfile(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/profile").RequireAuthorization();

        group.MapGet("", async (ClaimsPrincipal principal, UserManager<ApplicationUser> users, AppDbContext db, CancellationToken ct) =>
        {
            var user = await users.FindByIdAsync(UserIds.Get(principal));
            return user is null ? Results.Unauthorized() : Results.Ok(await Build(user, users, db, ct));
        });

        group.MapPut("", async (UpdateProfileRequest request, ClaimsPrincipal principal, UserManager<ApplicationUser> users, AppDbContext db, TimeProvider clock, CancellationToken ct) =>
        {
            var user = await users.FindByIdAsync(UserIds.Get(principal));
            if (user is null) return Results.Unauthorized();

            var problems = new Dictionary<string, string[]>();
            if (request.DisplayName is not null)
            {
                var name = request.DisplayName.Trim();
                if (name.Length > 64) problems["displayName"] = ["Keep the name under 64 characters."];
                else user.DisplayName = name.Length == 0 ? null : name;
            }
            if (request.AgeGroup is not null && !AgeGroups.Contains(request.AgeGroup)) problems["ageGroup"] = ["Pick one of the listed age groups."];
            if (request.Gender is not null && !Genders.Contains(request.Gender)) problems["gender"] = ["Pick one of the listed options."];
            if (problems.Count > 0) return Results.ValidationProblem(problems);

            if (request.HideName is { } hide) user.HideName = hide;
            var saved = await users.UpdateAsync(user);
            if (!saved.Succeeded) return Results.Problem(statusCode: StatusCodes.Status500InternalServerError, title: "Could not save the profile.");

            var profile = await db.UserProfiles.FirstOrDefaultAsync(p => p.UserId == user.Id, ct);
            if (profile is null)
            {
                profile = new UserProfile { UserId = user.Id };
                db.UserProfiles.Add(profile);
            }
            if (request.AgeGroup is not null) profile.AgeGroup = request.AgeGroup;
            if (request.ClearAgeGroup == true) profile.AgeGroup = null;
            if (request.Gender is not null) profile.Gender = request.Gender;
            if (request.ClearGender == true) profile.Gender = null;
            if (request.ShareCohort is { } share) profile.ShareCohort = share;
            profile.UpdatedAt = clock.GetUtcNow();
            await db.SaveChangesAsync(ct);

            return Results.Ok(await Build(user, users, db, ct));
        });

        // Adds a password (accounts that signed up with a social login) or changes it (the current one confirms).
        group.MapPost("/password", async (SetPasswordRequest request, ClaimsPrincipal principal, UserManager<ApplicationUser> users) =>
        {
            var user = await users.FindByIdAsync(UserIds.Get(principal));
            if (user is null) return Results.Unauthorized();
            if (string.IsNullOrEmpty(request.NewPassword)) return Results.ValidationProblem(new Dictionary<string, string[]> { ["password"] = ["Enter a new password."] });

            IdentityResult result;
            if (await users.HasPasswordAsync(user))
            {
                if (string.IsNullOrEmpty(request.CurrentPassword) || !await users.CheckPasswordAsync(user, request.CurrentPassword))
                    return Results.Problem(statusCode: StatusCodes.Status403Forbidden, title: "That password is not right.");
                result = await users.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
            }
            else
            {
                result = await users.AddPasswordAsync(user, request.NewPassword);
            }
            return result.Succeeded
                ? Results.NoContent()
                : Results.ValidationProblem(new Dictionary<string, string[]> { ["password"] = result.Errors.Select(e => e.Description).ToArray() });
        });

        // Connects a Google account to this account, so either way of signing in reaches the same data.
        group.MapPost("/providers/google", async (GoogleTokenRequest request, ClaimsPrincipal principal, UserManager<ApplicationUser> users, IGoogleTokenVerifier google, CancellationToken ct) =>
        {
            var user = await users.FindByIdAsync(UserIds.Get(principal));
            if (user is null) return Results.Unauthorized();
            var identity = await google.VerifyAsync(request.IdToken ?? "", ct);
            if (identity is null) return Results.Problem(statusCode: StatusCodes.Status400BadRequest, title: "Google sign-in could not be verified.");

            var owner = await users.FindByLoginAsync("Google", identity.Subject);
            if (owner is not null && owner.Id != user.Id)
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "That Google account is already connected to another Zenigma account.");
            if (owner is null)
            {
                var added = await users.AddLoginAsync(user, new UserLoginInfo("Google", identity.Subject, "Google"));
                if (!added.Succeeded) return Results.Problem(statusCode: StatusCodes.Status500InternalServerError, title: "Could not connect Google.");
            }
            return Results.NoContent();
        });

        // Disconnects Google, as long as another way to sign in remains.
        group.MapDelete("/providers/google", async (ClaimsPrincipal principal, UserManager<ApplicationUser> users) =>
        {
            var user = await users.FindByIdAsync(UserIds.Get(principal));
            if (user is null) return Results.Unauthorized();
            if (!await users.HasPasswordAsync(user))
                return Results.Problem(statusCode: StatusCodes.Status409Conflict, title: "Add a password first, so you can still sign in.");
            var logins = await users.GetLoginsAsync(user);
            foreach (var login in logins.Where(l => l.LoginProvider == "Google"))
                await users.RemoveLoginAsync(user, login.LoginProvider, login.ProviderKey);
            return Results.NoContent();
        });
    }

    private static async Task<ProfileDto> Build(ApplicationUser user, UserManager<ApplicationUser> users, AppDbContext db, CancellationToken ct)
    {
        var profile = await db.UserProfiles.AsNoTracking().FirstOrDefaultAsync(p => p.UserId == user.Id, ct);
        var logins = await users.GetLoginsAsync(user);
        return new ProfileDto(
            user.Email ?? "",
            user.DisplayName,
            await users.HasPasswordAsync(user),
            logins.Select(l => l.LoginProvider.ToLowerInvariant()).ToList(),
            profile?.AgeGroup,
            profile?.Gender,
            profile?.ShareCohort ?? false,
            user.HideName);
    }
}
