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
public record DeleteAccountRequest(string? Password, bool? Confirm);
public record ForgotRequest(string? Email);
public record ResetRequest(string? Email, string? Code, string? NewPassword, Guid? DeviceId);
public record VerifyRequest(string? Code);
public record GoogleLoginRequest(string? IdToken, Guid? DeviceId, string? DisplayName);

public static class AuthEndpoints
{
    private static string? _dummyHash;

    /// <summary>A throwaway password hash, built once, used to keep sign-in timing the same for unknown emails.</summary>
    private static string DummyHash(UserManager<ApplicationUser> users) =>
        _dummyHash ??= users.PasswordHasher.HashPassword(null!, Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(18)));

    private static string EmailTemplate(string title, string lead, string code, string note) =>
        $"<div style=\"font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:420px;margin:auto;padding:24px;color:#1a2321\"><h2 style=\"margin:0 0 12px\">{title}</h2><p style=\"margin:0 0 8px\">{lead}</p><p style=\"font-size:32px;letter-spacing:8px;font-weight:700;margin:8px 0 16px\">{code}</p><p style=\"color:#5b6b66;font-size:13px;margin:0\">{note}</p></div>";

    public static void MapAuth(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/auth").RequireRateLimiting("auth");

        group.MapPost("/register", async (
            RegisterRequest request,
            UserManager<ApplicationUser> users,
            TokenService tokens,
            ILoggerFactory loggers,
            CancellationToken ct) =>
        {
            var log = loggers.CreateLogger("Security");
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

            log.LogInformation("Security: account created {UserId} (email)", user.Id);
            return Results.Ok(await tokens.IssueAsync(user, request.DeviceId, ct));
        });

        group.MapPost("/login", async (
            LoginRequest request,
            UserManager<ApplicationUser> users,
            TokenService tokens,
            ILoggerFactory loggers,
            HttpContext http,
            CancellationToken ct) =>
        {
            var log = loggers.CreateLogger("Security");
            var invalid = Results.Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Wrong email or password.");

            var user = string.IsNullOrWhiteSpace(request.Email) ? null : await users.FindByEmailAsync(request.Email.Trim());
            if (user is null || string.IsNullOrEmpty(request.Password))
            {
                // Hash anyway, so an unknown email takes as long as a wrong password and cannot be told apart by timing.
                if (!string.IsNullOrEmpty(request.Password)) users.PasswordHasher.VerifyHashedPassword(null!, DummyHash(users), request.Password);
                log.LogInformation("Security: failed sign-in (unknown account) from {Ip}", http.Connection.RemoteIpAddress);
                return invalid;
            }
            if (await users.IsLockedOutAsync(user))
            {
                log.LogWarning("Security: sign-in refused, account {UserId} is locked out (from {Ip})", user.Id, http.Connection.RemoteIpAddress);
                return Results.Problem(statusCode: StatusCodes.Status429TooManyRequests, title: "Too many attempts. Try again later.");
            }

            if (!await users.CheckPasswordAsync(user, request.Password))
            {
                await users.AccessFailedAsync(user);
                log.LogWarning("Security: failed sign-in for account {UserId} from {Ip}", user.Id, http.Connection.RemoteIpAddress);
                return invalid;
            }

            await users.ResetAccessFailedCountAsync(user);
            return Results.Ok(await tokens.IssueAsync(user, request.DeviceId, ct));
        });

        // What the sign-in screen needs to know: whether Google sign-in is set up, and the public client id for it.
        group.MapGet("/config", (Microsoft.Extensions.Options.IOptions<GoogleOptions> google, IEmailSender mail) =>
            Results.Ok(new { googleClientId = google.Value.ClientId.Length > 0 ? google.Value.ClientId : null, email = mail.Enabled }));

        // Forgot password: emails a six-digit code. The answer is the same whether or not the address has an account.
        group.MapPost("/forgot", async (
            ForgotRequest request,
            UserManager<ApplicationUser> users,
            EmailCodeService codes,
            IEmailSender mail,
            ILoggerFactory loggers,
            HttpContext http,
            CancellationToken ct) =>
        {
            var log = loggers.CreateLogger("Security");
            if (!mail.Enabled) return Results.Problem(statusCode: StatusCodes.Status501NotImplemented, title: "Email is not set up on this server.");
            var user = string.IsNullOrWhiteSpace(request.Email) ? null : await users.FindByEmailAsync(request.Email.Trim());
            if (user?.Email is not null)
            {
                var code = await codes.IssueAsync(user.Id, EmailCodeService.Reset, ct);
                if (code is not null)
                {
                    log.LogInformation("Security: password reset code sent for account {UserId} (asked from {Ip})", user.Id, http.Connection.RemoteIpAddress);
                    await mail.SendAsync(user.Email, "Your Zenigma password reset code",
                        $"Your Zenigma code is {code}. It works for 15 minutes. If you did not ask to reset your password, ignore this email.",
                        EmailTemplate("Reset your password", "Your Zenigma code is", code, "It works for 15 minutes. If you did not ask to reset your password, you can ignore this email."), ct);
                }
            }
            return Results.Ok(new { sent = true });
        }).RequireRateLimiting("mail");

        // Sets a new password with the emailed code, ends every other session, and signs the person in.
        group.MapPost("/reset", async (
            ResetRequest request,
            UserManager<ApplicationUser> users,
            EmailCodeService codes,
            TokenService tokens,
            ILoggerFactory loggers,
            HttpContext http,
            CancellationToken ct) =>
        {
            var log = loggers.CreateLogger("Security");
            var wrong = Results.Problem(statusCode: StatusCodes.Status400BadRequest, title: "That code is not right, or it has expired.");
            var user = string.IsNullOrWhiteSpace(request.Email) ? null : await users.FindByEmailAsync(request.Email.Trim());
            if (user is null) return wrong;

            // Check the new password first, so a weak one does not use up the code.
            var problems = new List<string>();
            foreach (var validator in users.PasswordValidators)
            {
                var checkedPassword = await validator.ValidateAsync(users, user, request.NewPassword ?? "");
                problems.AddRange(checkedPassword.Errors.Select(e => e.Description));
            }
            if (problems.Count > 0) return Results.ValidationProblem(new Dictionary<string, string[]> { ["password"] = [.. problems] });

            if (!await codes.ConsumeAsync(user.Id, EmailCodeService.Reset, request.Code, ct))
            {
                log.LogWarning("Security: wrong or expired reset code for account {UserId} from {Ip}", user.Id, http.Connection.RemoteIpAddress);
                return wrong;
            }

            if (await users.HasPasswordAsync(user)) await users.RemovePasswordAsync(user);
            var added = await users.AddPasswordAsync(user, request.NewPassword!);
            if (!added.Succeeded) return Results.Problem(statusCode: StatusCodes.Status500InternalServerError, title: "Could not set the password.");
            // Reading the mailbox proves the address, so it is confirmed too, and a lockout from failed tries is lifted.
            user.EmailConfirmed = true;
            await users.UpdateAsync(user);
            await users.SetLockoutEndDateAsync(user, null);
            await users.ResetAccessFailedCountAsync(user);
            await tokens.RevokeAllAsync(user.Id, ct);
            log.LogWarning("Security: password reset by email for account {UserId} from {Ip}; all sessions ended", user.Id, http.Connection.RemoteIpAddress);
            return Results.Ok(await tokens.IssueAsync(user, request.DeviceId, ct));
        });

        // Confirms the signed-in person's address: first asks for a code, then checks it.
        group.MapPost("/verify/send", async (
            ClaimsPrincipal principal,
            UserManager<ApplicationUser> users,
            EmailCodeService codes,
            IEmailSender mail,
            CancellationToken ct) =>
        {
            if (!mail.Enabled) return Results.Problem(statusCode: StatusCodes.Status501NotImplemented, title: "Email is not set up on this server.");
            var user = await users.FindByIdAsync(UserIds.Get(principal));
            if (user?.Email is null) return Results.Unauthorized();
            if (user.EmailConfirmed) return Results.Ok(new { verified = true });
            var code = await codes.IssueAsync(user.Id, EmailCodeService.Verify, ct);
            if (code is null) return Results.Problem(statusCode: StatusCodes.Status429TooManyRequests, title: "A code was sent a moment ago. Check your inbox, or wait a minute.");
            await mail.SendAsync(user.Email, "Confirm your Zenigma email",
                $"Your Zenigma code is {code}. It works for 15 minutes.",
                EmailTemplate("Confirm your email", "Your Zenigma code is", code, "It works for 15 minutes."), ct);
            return Results.Ok(new { sent = true });
        }).RequireAuthorization().RequireRateLimiting("mail");

        group.MapPost("/verify", async (
            VerifyRequest request,
            ClaimsPrincipal principal,
            UserManager<ApplicationUser> users,
            EmailCodeService codes,
            CancellationToken ct) =>
        {
            var user = await users.FindByIdAsync(UserIds.Get(principal));
            if (user is null) return Results.Unauthorized();
            if (!user.EmailConfirmed)
            {
                if (!await codes.ConsumeAsync(user.Id, EmailCodeService.Verify, request.Code, ct))
                    return Results.Problem(statusCode: StatusCodes.Status400BadRequest, title: "That code is not right, or it has expired.");
                user.EmailConfirmed = true;
                await users.UpdateAsync(user);
            }
            return Results.Ok(new { verified = true });
        }).RequireAuthorization();


        // Sign in with Google: finds the account connected to this Google identity, else the account with the same verified email
        // (and connects it), else creates a new account that has no password.
        group.MapPost("/google", async (
            GoogleLoginRequest request,
            UserManager<ApplicationUser> users,
            IGoogleTokenVerifier google,
            Microsoft.Extensions.Options.IOptions<GoogleOptions> options,
            TokenService tokens,
            ILoggerFactory loggers,
            CancellationToken ct) =>
        {
            var log = loggers.CreateLogger("Security");
            if (options.Value.ClientId.Length == 0)
                return Results.Problem(statusCode: StatusCodes.Status501NotImplemented, title: "Google sign-in is not set up on this server.");
            var identity = await google.VerifyAsync(request.IdToken ?? "", ct);
            if (identity is null || !identity.EmailVerified)
                return Results.Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Google sign-in could not be verified.");

            var user = await users.FindByLoginAsync("Google", identity.Subject);
            if (user is null)
            {
                user = await users.FindByEmailAsync(identity.Email);
                if (user is not null && !user.EmailConfirmed)
                {
                    // Someone may have signed up with this address before its owner did (the address was never confirmed), and
                    // would still know that password. Google has just proven the address is this person's, so the old password
                    // and every old session are removed before the account is handed over.
                    if (await users.HasPasswordAsync(user)) await users.RemovePasswordAsync(user);
                    user.EmailConfirmed = true;
                    await users.UpdateAsync(user);
                    await tokens.RevokeAllAsync(user.Id, ct);
                    log.LogWarning("Security: unverified account {UserId} was claimed through Google; its password and sessions were removed", user.Id);
                }
                if (user is null)
                {
                    var name = string.IsNullOrWhiteSpace(request.DisplayName) ? identity.Name : request.DisplayName.Trim();
                    user = new ApplicationUser { UserName = identity.Email, Email = identity.Email, EmailConfirmed = true, DisplayName = name is { Length: > 64 } ? name[..64] : name };
                    var created = await users.CreateAsync(user);
                    if (!created.Succeeded) return Results.Problem(statusCode: StatusCodes.Status500InternalServerError, title: "Could not create the account.");
                }
                var linked = await users.AddLoginAsync(user, new UserLoginInfo("Google", identity.Subject, "Google"));
                if (!linked.Succeeded) return Results.Problem(statusCode: StatusCodes.Status500InternalServerError, title: "Could not connect Google.");
            }

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

        // Deletes the account and everything tied to it (results, streaks, circles it owns, devices). The password confirms it.
        group.MapPost("/delete-account", async (DeleteAccountRequest request, ClaimsPrincipal principal, UserManager<ApplicationUser> users) =>
        {
            var user = await users.FindByIdAsync(UserIds.Get(principal));
            if (user is null) return Results.Unauthorized();
            // An account with a password confirms with it; one that only signs in with Google confirms with the explicit flag.
            var confirmed = await users.HasPasswordAsync(user)
                ? !string.IsNullOrEmpty(request.Password) && await users.CheckPasswordAsync(user, request.Password)
                : request.Confirm == true;
            if (!confirmed)
                return Results.Problem(statusCode: StatusCodes.Status403Forbidden, title: "That password is not right.");
            var result = await users.DeleteAsync(user);
            return result.Succeeded ? Results.NoContent() : Results.Problem(statusCode: StatusCodes.Status500InternalServerError, title: "Could not delete the account.");
        }).RequireAuthorization();

        group.MapGet("/me", async (ClaimsPrincipal principal, UserManager<ApplicationUser> users) =>
        {
            var user = await users.FindByIdAsync(UserIds.Get(principal));
            return user is null
                ? Results.Unauthorized()
                : Results.Ok(new AuthUserDto(user.Id, user.Email ?? "", user.DisplayName, user.EmailConfirmed));
        }).RequireAuthorization();
    }
}
