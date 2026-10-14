# Scaling and staying up

What protects the API and database when many people play at once, what each setting does, and the limits that code cannot remove.

## What the code does

| Protection | Where | Why |
| --- | --- | --- |
| One round trip per sync push | `Sync/SyncEndpoints.cs` | A push of up to 200 events is one `INSERT ... unnest(...)` statement (and one more for practice solves) instead of one query per event. The database is a network hop away, so this is the biggest saving. |
| Shared, short-lived leaderboards | `Infrastructure/BoardCache.cs` | Boards are computed once per 20 seconds and shared. If 500 people open the same board together, the database runs one query. Setting `Cache__BoardSeconds=0` turns it off. |
| Indexes for payload boards | `db/migrations/V9__scale_indexes.sql` | The Mind and weekly-featured boards read inside `sync_events`; without an index every request scanned the whole log. |
| Concurrency ceiling | `Program.cs` (global limiter) | At most 48 requests run at once, up to 200 wait, the rest get `429` with `Retry-After`. A small CPU that tries to do everything at once is slower for everybody. |
| Password hashing gate | `Program.cs` | Only 3 sign-ins or sign-ups hash at once. A login burst cannot starve the rest of the app. |
| Per-user allowance | `Program.cs` | 400 requests a minute per signed-in user, 600 per address when anonymous. Stops one buggy client from flooding. |
| Pooled DbContexts | `Program.cs` | Less allocation per request. |
| Connection settings | `Infrastructure/ConnectionStrings.cs` | Pool of 20, 20 s connect timeout (enough to wake Neon), 20 s command timeout (a runaway query is cancelled), connections recycled every 5 minutes, keep-alive, and no session reset on the Neon pooler. Anything you put in the connection string yourself wins. |
| Body and connection caps | `Program.cs` | 8 MB request body, 400 open connections, 15 s to send headers. |
| CORS preflight cache | `Program.cs` | Browsers remember the OPTIONS answer for an hour. |
| `/health/db` | `Program.cs` | A manual readiness check that also reports how long the database took. Do not poll it: it wakes Neon. `/health` stays free of the database. |

## What you set up (not in code)

1. **Neon: use the pooled connection string.** In the Neon console choose the connection string with **Pooled connection** on (the host contains `-pooler`). It goes through PgBouncer, so thousands of client connections share a few database connections. Put that in `ConnectionStrings__Default` on Render.
2. **Neon: keep Flyway on the direct (non-pooled) string.** Migrations take locks and should not go through the pooler. The deploy workflow already has its own secret for this.
3. **Render: a single instance is fine, but not on the free plan if you need it always awake.** The free plan sleeps after idle time (the first request waits ~30-60 s) and has 512 MB RAM and a shared fraction of a CPU. A paid Starter instance never sleeps and has a full CPU share. Upgrading is the single biggest step if the app grows.
4. **Neon: autosuspend.** On the free plan the database suspends when idle and wakes in a second or two on the next query; the 20 s connect timeout allows for it. On a paid plan you can switch suspend off.
5. **Cloudflare Pages serves the app and all level packs**, so puzzle downloads never touch Render.

## What the app already avoids

- Level packs are static files (Cloudflare), practice is offline, and the daily puzzle is cached on the device after the first fetch. Most play never reaches the API.
- Sync is incremental (a cursor), batched, and idempotent: a retried push cannot duplicate events.
- The home screen counts are cached for 15 seconds on the server.

## Limits that remain, honestly

- No code can promise "never crashes". The free tiers have hard ceilings (RAM, CPU, database compute and storage). The settings above make the app degrade by slowing down or answering `429 Retry-After`, instead of falling over; they do not raise the ceilings.
- The leaderboards for Mind and the weekly featured level read the event log. That is fine up to a few hundred thousand events with the V9 indexes. Past that, move them to their own small table (a "if it ever hurts" step, not needed now).
- `sync_events` grows forever. At roughly 1 KB an event, 1 million events is about 1 GB; the Neon free plan stores 0.5 GB. Watch the database size in the Neon console; when it nears the limit, either upgrade or archive events older than a year.
- Nothing here was load tested against the real services. `tests/load/k6-smoke.js` is a ready script: run it against a copy (not production with real players) and read the p95 latency and the `429` rate. If `p95` is above ~1.5 s with 50 users, upgrade Render first, then Neon.

## Reading the signals

- Render dashboard: CPU pinned near 100 % or memory near the limit means upgrade the instance.
- Many `429` in the logs means the ceiling is doing its job; raise `PermitLimit` in `Program.cs` only after the instance has been upgraded.
- Neon dashboard: "connections" and "compute time". If connections hit the plan limit, check that the pooled string is in use.
