# Zenigma deployment plan

Everything runs on free tiers and nothing is kept awake. **No keep-alive pings, no health-check polling.** The API
and database may sleep; the apps are offline-first, so a cold start only delays a sync, never play.

## Architecture

| Piece | Host | URL |
|---|---|---|
| Web app (installable PWA) | Cloudflare Pages | `https://zenigma.ska97homelab.uk` |
| API (.NET 10, Docker) | Render web service | `https://zenigma-api.ska97homelab.uk` |
| Database (PostgreSQL) | Neon | private |
| Android APK | GitHub Releases | in-app updater, user-initiated |
| Schema changes | Flyway, run by GitHub Actions | `db/migrations` |

The Android app ships its own web files and only talks to the API, so web deploys never break installed apps.

## One-time setup

### 1. Neon (database)
1. Create a project `zenigma`, Postgres 16, region closest to Render (Singapore if available).
2. Create two roles: `zenigma_migrator` (owner of the schema, used by Flyway) and `zenigma_app` (used by the API).
3. Keep the pooled connection string for the API and the direct one for Flyway.
4. Run the first deploy (below) to create the schema, then grant the app role data access only:
   ```sql
   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO zenigma_app;
   GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO zenigma_app;
   ALTER DEFAULT PRIVILEGES FOR ROLE zenigma_migrator IN SCHEMA public
     GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO zenigma_app;
   ALTER DEFAULT PRIVILEGES FOR ROLE zenigma_migrator IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO zenigma_app;
   ```
   The API therefore cannot change the schema even if compromised.

### 2. Render (API)
1. New Web Service from this repo, runtime **Docker**, root directory `apps/api`, Dockerfile `apps/api/Dockerfile`.
2. **Turn Auto-Deploy off** (the deploy workflow triggers it after migrations).
3. Health check path: leave empty. (Do not add one: it would poll the service and keep it awake.)
4. Environment variables:

| Variable | Value |
|---|---|
| `ConnectionStrings__Default` | Neon pooled URI for `zenigma_app` (`postgresql://...?sslmode=require`) |
| `Jwt__Key` | 64+ random characters (`openssl rand -base64 48`) |
| `Jwt__Issuer` / `Jwt__Audience` | `zenigma-api` / `zenigma-app` (defaults) |
| `Cors__Origins__0` | `https://zenigma.ska97homelab.uk` |
| `ASPNETCORE_HTTP_PORTS` | `8080` |

5. Create a **Deploy Hook** (Settings) and keep its URL for GitHub.
6. Custom domain `zenigma-api.ska97homelab.uk` (Render shows the CNAME to add).

Rotating `Jwt__Key` signs everyone out of access tokens only; refresh tokens are random values in the database, so
sessions renew silently.

### 3. Cloudflare (web)
1. Pages project `zenigma` (direct upload; GitHub Actions deploys it).
2. Custom domain `zenigma.ska97homelab.uk`.
3. `public/_redirects` gives single-page-app routing; `public/_headers` keeps the service worker uncached so updates
   arrive promptly.
4. DNS for `ska97homelab.uk`: CNAME `zenigma` to the Pages project; CNAME `zenigma-api` to the Render hostname
   (proxy status DNS-only for the API so Render manages its certificate).

### 4. GitHub (secrets and environment)
Create an environment named `production` and add:

| Secret | Used by |
|---|---|
| `FLYWAY_URL` (`jdbc:postgresql://<direct-host>/zenigma?sslmode=require`), `FLYWAY_USER`, `FLYWAY_PASSWORD` | migrate job (migrator role) |
| `RENDER_DEPLOY_HOOK_URL` | api job |
| `CLOUDFLARE_API_TOKEN` (Pages: Edit), `CLOUDFLARE_ACCOUNT_ID` | web job |
| `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` | release-android workflow |

Branch protection on `main`: require the three CI jobs (API, Web, Android) and pull requests.

### 5. Android signing key (once, keep it forever)
```bash
keytool -genkeypair -v -keystore zenigma.keystore -alias zenigma -keyalg RSA -keysize 4096 -validity 10000
base64 -w0 zenigma.keystore   # paste into ANDROID_KEYSTORE_BASE64
```
Back the keystore up somewhere safe (password manager plus an offline copy). **If it is lost, installed apps can
never be updated** (Android refuses an update signed with a different key); users would have to reinstall.

## Everyday flow

1. Work on a branch, open a PR. CI runs: Flyway on a throwaway Postgres, .NET build and tests, web tests and build,
   Android debug build.
2. Merge to `main`. The **Deploy** workflow runs in order:
   1. `migrate`: Flyway applies new `V*__*.sql` files to Neon. A failed migration stops everything; nothing deploys.
   2. `api` and `web` in parallel: Render redeploys the API; Cloudflare Pages publishes the web build.
3. Android release (only when the app itself changed):
   1. Add `mobile/release-notes/<version>.md` (what changed, in plain words) and merge it.
   2. `git tag android-v0.2.0 && git push origin android-v0.2.0`.
   3. The **Release Android** workflow builds a signed APK, sets `versionName`/`versionCode` from the tag
      (`major*10000 + minor*100 + patch`) and publishes the GitHub Release.
   4. Installed apps offer the update when the user opens Settings and taps **Check for updates**. Nothing checks in
      the background.

## Database changes

- Only through Flyway files in `db/migrations`, named `V<n>__description.sql`. Never edit a file that has been merged;
  add a new one.
- Make changes backwards compatible for one release (add columns/tables first, remove later): the old API keeps
  running for the minute between migration and redeploy, and installed apps sync with whichever version is live.
- Neon keeps point-in-time history on the free tier for a short window; before any destructive migration, create a
  Neon branch of production first.

## Daily puzzles (Phase 2 onward)

A scheduled GitHub Action (`puzzle-batch.yml`, added with the first game) generates the next days' puzzles with the
tools in `tools/generators` and loads them with a Flyway-style versioned data file or a guarded SQL step, ahead of
time (for example 14 days). Daily rollover is 00:00 IST, decided by the server clock (`GET /time`), so no cron is
needed inside the database and an idle service costs nothing.

## Cold starts and offline behaviour

- Render's free web service sleeps after idle time and takes tens of seconds to wake on the first request; Neon
  wakes in about a second. Both are acceptable because sync is background work after a local save.
- First request after sleep may time out; the sync layer keeps events in the outbox and retries on the next trigger
  (a local change, regaining connection, or opening the app). Sign-in shows a "server is waking up" state rather
  than failing hard (to do with the first online screens).
- If you later want zero cold starts, move the API to a paid instance; nothing else changes.

## Observability and safety

- Render log stream for the API; no third-party monitoring needed at launch.
- Rate limit on `/auth/*` (30 per minute per IP) is built in; Cloudflare's free WAF rules can sit in front later.
- Secrets live only in Render and GitHub environments, never in the repo (`.gitignore` blocks keystores and `.env`).
- Refresh tokens are stored as hashes and rotated on every use.

## Rollback

- **API**: Render, Deploys, Rollback to the previous deploy (migrations are backward compatible by rule above).
- **Web**: Cloudflare Pages, Deployments, Rollback.
- **Android**: publish a new higher version; Android does not allow installing a lower versionCode over a newer one.
- **Database**: Neon branch/restore; prefer forward fix migrations.

## Before the public launch

- Trademark, domain and Play/other store name checks for "Zenigma" (registration is not required to publish, but a
  conflict could force a rename later).
- Privacy policy and account deletion route (required by Google Play, also good practice for the APK).
- Decide the update channel for Play Store later; the in-app APK updater must be disabled in a Play build.
