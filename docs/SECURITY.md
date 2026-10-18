# Security

Mapping to the OWASP Top 10 (2025 edition naming; controls apply equally to the 2021 list).

| Risk | What Zenigma does |
|---|---|
| A01 Broken access control | Every user route uses `RequireAuthorization`; data is always scoped to the JWT user id. Circle joins are rate limited (10/min/user) against code brute force. |
| A02 Security misconfiguration | API sends nosniff, no-referrer, X-Frame-Options DENY, `default-src 'none'` CSP, HSTS, `no-store`. Web has an enforced CSP, HSTS and COOP via `public/_headers`. Production CORS has no plain localhost. Android `allowBackup=false`. |
| A03 Supply chain | Actions pinned to commit SHAs, Dependabot (nuget, npm, gradle, docker, actions), `npm audit` and NuGet vulnerability check in CI, CodeQL weekly and on PRs. |
| A04 Cryptographic failures | PBKDF2 at 210,000 iterations. JWT pinned to HS256 with signature, expiry and issuer checks. HTTPS only (HSTS). |
| A05 Injection | EF Core parameterised queries only; Angular template escaping; CSP blocks inline scripts. |
| A06 Insecure design | Refresh tokens rotate atomically; reuse of a token revoked over 60 s ago revokes all sessions of that user. Password change ends other sessions. |
| A07 Authentication failures | Lockout on repeated failures, dummy hash for unknown emails (no timing leak), Google sign-in cannot take over an unverified password account (password is removed, sessions revoked). Auth endpoints rate limited. |
| A08 Integrity failures | Signed releases; CI-only deploys from main; pinned actions. |
| A09 Logging and alerting | "Security" log category: register, failed login, lockout, token reuse, password change, rate-limit rejections, with client IP. |
| A10 Mishandling of exceptional conditions | 30 s request timeouts, rate limiter returns 429, hourly cleanup of stale refresh tokens. |

## Actions only you can do
1. GitHub: branch protection on `main` with required CI checks; enable secret scanning, push protection and Dependabot alerts; 2FA.
2. 2FA on Render, Neon, Cloudflare and Google.
3. Rotate `Jwt__Key` and DB password if they were ever shared or pasted anywhere.
4. Neon: use a least-privilege app role (no superuser/DDL); keep Flyway on a separate owner role; check backups/PITR.
5. Cloudflare: put the API domain behind WAF and bot protection. If you do, the API sees Cloudflare IPs, so configure forwarded headers before relying on per-IP limits.
6. Render: enable log retention and failure alerts.
7. Back up the Android keystore and its password in two places.

## Accepted risks
- Registration reveals if an email exists (rate limited).
- Forgot password and email confirmation need Brevo set up (`docs/DEPLOYMENT.md`, `docs/OPERATIONS.md`); until its environment variables are set on the API, those emails are not sent.
- Mind-daily, word-daily and featured leaderboards trust client-reported scores; they are for fun.
- Someone with an unverified password account who later uses "Continue with Google" loses that password and can set one again in Profile.

## Scan yourself
```
docker run --rm -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t https://zenigma-api.ska97homelab.uk
docker run --rm -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t https://zenigma.ska97homelab.uk
```
