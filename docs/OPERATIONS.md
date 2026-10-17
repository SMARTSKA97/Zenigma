# Operations: email, usage and speed

Day-to-day checks for the free-tier setup. Dashboard menus move around, so where a name below does not match exactly, look for the closest one.

## 1. Brevo, step by step (you already use Brevo for other apps)

Zenigma needs only three things from Brevo: a **sender address**, an **API key**, and a few **environment variables on Render**. You can keep using the same Brevo account; the free plan's **300 emails a day are shared by every app on the account**, so give Zenigma a smaller share.

1. **Sender.** Brevo, Settings, *Senders, domains & dedicated IPs*, Senders, *Add a sender*. Use an address on a domain you own, such as `noreply@ska97homelab.uk`, name `Zenigma`. Brevo emails a link to that address; open it to verify.
   - If that domain is already authenticated for your other apps (Settings, Senders & IP, *Domains*, shows a green tick), nothing more is needed: any address on it can be a sender.
   - If not, add the domain and create the DNS records Brevo shows (a verification TXT, a DKIM record, a DMARC TXT). On Cloudflare set the DKIM record to *DNS only* (grey cloud). Wait up to a day. Without this, codes can land in spam.
2. **API key.** Brevo, *SMTP & API*, *API Keys* tab, *Generate a new API key*, name it `zenigma-render`. Copy it once. (A separate key per app lets you revoke one without touching the others. The *SMTP* key is a different thing and will not work here.)
3. **Render.** Your API service, *Environment*, add:
   - `Brevo__ApiKey` = the key
   - `Brevo__SenderEmail` = the verified sender address
   - `Brevo__SenderName` = `Zenigma` (optional)
   - `Email__DailyBudget` = for example `100`, how many codes Zenigma may send per day. Leave out for the default 250. If your other apps use about 150 a day, 100 here keeps the total under 300.
   Save; Render redeploys. The app shows "Forgot password?" only once the key and sender exist.
4. **Test.** In the app (web is easiest) open Account, *Forgot password?*, enter your own email, and check the code arrives. In Brevo, *Transactional*, *Logs* shows each send and whether it was delivered or bounced.
5. **If nothing arrives:** check Brevo logs (blocked sender, unverified address, daily limit), then Render logs for `Brevo` warnings, then the spam folder. A `401` in the logs means the key is wrong; a "sender not valid" error means step 1 is not finished.

Limits built into the app are listed in `DEPLOYMENT.md` (15-minute codes, 5 tries, 1 per minute and 5 per hour per person, 5 requests a minute per IP).

## 2. Checking Render usage and what is left

Render's free web service has three allowances (Render's own free-tier page is the authority; amounts can change):

- **750 free instance hours a month**, shared by all free services in the workspace. A service that is spun down uses none. At 750 hours every free service is suspended until the next month. One service running all month needs about 744, so it fits, but a second always-on free service would not.
- **Outbound bandwidth** and **build minutes**. These are included amounts; going over is billed (or, without a payment method, services are suspended for the rest of the month).
- **Spin-down** after 15 minutes without a request; the next request takes about a minute.

**Where to look:** Render Dashboard, your workspace, *Billing*, section **Monthly Included Usage**. It shows hours, bandwidth and build minutes used against the included amount. Render also emails you when you approach and when you exceed a limit; check that the account email is one you read. For live load, the service's *Metrics* tab shows CPU, memory and bandwidth over time.

**Rule of thumb for Zenigma:** the app wakes the server only when needed, so a quiet day costs a few hours, not 24. If Monthly Included Usage shows hours climbing faster than about 25 a day, something is keeping it awake (an uptime pinger, a monitor, or a script polling the API).

## 3. Checking Neon usage (the CU-hours view)

On the free plan, Neon allows roughly **100 CU-hours of compute a month per project**, **1 GB of storage per project** and **5 GB of public network transfer a month**. When compute or transfer runs out the database is suspended until the next period; when storage is full, writes that add data fail. Nothing is deleted. (Check Neon's plans page for the current numbers.)

**Where to look:** Neon Console, the *Projects* page shows Compute, Storage, History and Network transfer for the month; the project's *Monitoring* page shows RAM, CPU, connections and database size (free plans keep one day of data). Compute is counted only while the database is awake: it suspends itself after a few idle minutes, so fewer requests mean fewer CU-hours.

**Keeping it small:** use the pooled connection string (host contains `-pooler`) so connections do not pile up; the API already batches syncs and caches boards for 20 seconds.

## 4. Finding slow queries

`pg_stat_statements` records how long each distinct query takes. On Neon it is available; enable it once in the SQL editor:

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

After a day of real use, the slowest by total time:

```sql
SELECT left(query, 120) AS query, calls,
       round(total_exec_time::numeric) AS total_ms,
       round(mean_exec_time::numeric, 1) AS mean_ms,
       rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 15;
```

What to look for: a high `mean_ms` (slow each time) or a huge `calls` (cheap but constant). For a slow one, run `EXPLAIN (ANALYZE, BUFFERS)` on it; a `Seq Scan` on a big table means an index is missing. Table sizes, to see what is growing:

```sql
SELECT relname, pg_size_pretty(pg_total_relation_size(relid)) AS size
FROM pg_catalog.pg_statio_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 10;
```

What was already tuned (migration `V12`, and code): per-player stats read only the columns they need and use partial indexes; old daily mind-training events are removed after `Retention__MindDays` days (default 180, `0` turns it off; progress events are never removed); the boards, stats and daily hub answer repeat requests with an ETag so unchanged answers cost a few bytes.

## 5. Load test

See `loadtest/README.md`. Run it from your own computer, off-peak, with a throwaway account.
