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

```bash
# Database
docker run -d --name zenigma-db -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=zenigma -p 127.0.0.1:5432:5432 postgres:16
docker run --rm --network host -v "$PWD/db/migrations:/flyway/sql" flyway/flyway:11 \
  -url=jdbc:postgresql://localhost:5432/zenigma -user=postgres migrate

# API (http://localhost:5080)
cd apps/api/Zenigma.Api
export ConnectionStrings__Default="Host=localhost;Database=zenigma;Username=postgres"
export Jwt__Key="$(openssl rand -base64 48)"
dotnet run --urls http://localhost:5080

# Web (http://localhost:4200)
cd apps/web && npm ci && npx ng serve
```

Tests: `dotnet test apps/api/Zenigma.slnx` (set `ZENIGMA_TEST_DB` to run the database tests) and `cd apps/web && npx ng test`.
