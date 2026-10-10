# Zenigma

Offline-first puzzle and brain-game app: Android (Capacitor) and web (installable PWA), with an ASP.NET Core API on
PostgreSQL. Ten games (Word Guess, LinkedIn's Queens, Tango, Mini Sudoku, Zip, Patches, Pinpoint, Crossclimb, Wend,
and Comet Slice), daily puzzles plus endless levels, streaks and leaderboards.

| Path | What |
|---|---|
| `apps/web` | Angular 22 app (also the Android UI) and the Capacitor Android project |
| `apps/api` | .NET 10 API: auth, sync, server clock |
| `db/migrations` | Flyway SQL migrations (the only way the schema changes) |
| `tests/vectors` | Shared test vectors for the TypeScript and C# game engines |
| `mobile/release-notes` | One `<version>.md` per Android release |
| `docs/DEPLOYMENT.md` | Hosting, secrets and release flow |

## Develop

Secrets live in a git-ignored `.env` file, never in source. Start from the template:

```bash
cp .env.example .env        # then fill in the blanks; generate values with: openssl rand -base64 48
docker compose up -d db                 # local Postgres (uses POSTGRES_* from .env)
docker compose run --rm migrate         # apply db/migrations with Flyway

# API (http://localhost:5080): reads .env automatically in development
cd apps/api/Zenigma.Api && dotnet run --urls http://localhost:5080

# Web (http://localhost:4200)
cd apps/web && npm ci && npx ng serve
```

The API's `ConnectionStrings__Default` password must match `POSTGRES_PASSWORD`. In production the same names are set as
environment variables (Render) and GitHub secrets; see `docs/DEPLOYMENT.md`.

Tests: `dotnet test apps/api/Zenigma.slnx` (set `ZENIGMA_TEST_DB` in `.env` to run the database tests) and `cd apps/web && npx ng test`.
