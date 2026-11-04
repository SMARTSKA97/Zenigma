# Cloudflare setup (Free plan)

Two hostnames sit behind one zone (`ska97homelab.uk`): the web app (`zenigma.…`, Cloudflare Pages) and the API (`zenigma-api.…`, proxied to Render).
`scripts/cloudflare_setup.py` makes every change below in one repeatable step. Do the steps in this order.

## 1. Find out what is blocking updates (2 minutes, read-only)

Dashboard → your domain → **Security → Events**. Set the filter to the last 24 hours and look for `/ngsw.json`, `/ngsw-worker.js` or `/index.html`.
The **Service** column names the feature that stopped them:

| Service shown | What it means | Fix |
| --- | --- | --- |
| Browser Integrity Check, Security Level, User agent blocking | A zone rule | Step 3 skips them for the update files |
| **Bot Fight Mode** | **Cannot be skipped by any rule on the Free plan** (Cloudflare says so in its docs) | Turn it off in step 3 and rely on the rules below |
| Nothing listed | Cloudflare is not the cause | Tell me; the problem is elsewhere |

## 2. Make an API token

My profile → API Tokens → Create Token → Custom token. Permissions (all on the zone `ska97homelab.uk`):
`Zone · Zone · Read`, `Zone · Zone Settings · Edit`, `Zone · Zone WAF · Edit`, `Zone · Transform Rules · Edit`.
Add `Zone · Bot Management · Edit` only if you use `--bot-fight`.

## 3. Run the script

```bash
export CF_API_TOKEN=...                  # PowerShell: $env:CF_API_TOKEN="..."
python scripts/cloudflare_setup.py       # preview, changes nothing
python scripts/cloudflare_setup.py --apply
python scripts/cloudflare_setup.py --apply --bot-fight off   # only if step 1 showed Bot Fight Mode
```

What it sets (rules are all named `zenigma: …`, and re-running updates them; your own rules are untouched):

- **Skip rule** for the web hostname's update files (`/ngsw.json`, `/ngsw-worker.js`, `/index.html`, `/manifest.webmanifest`, `/assets`, `/icons`, `/levels`, `/fonts`): bypasses Browser Integrity Check, Security Level and user-agent blocking so the app's background updater is never challenged.
- **Skip** challenges for the API hostname: the app's own API calls cannot solve a challenge page, so a challenge (common on phone mobile data, where many people share one address) shows up in the app as "Could not load".
- **Block** probes for files we never serve (`/wp-…`, `/.env`, `/.git`, `.php`, `.sql`, `phpmyadmin`).
- **Block** API calls with no user agent.
- **Rate limit** (the one rule the Free plan allows): at most 60 API requests per 10 seconds from one address.
- **Request header** `X-Zenigma-Edge: <secret>` added to every API request (see step 4).
- Zone settings: Always Use HTTPS, TLS 1.2 minimum, Browser Integrity Check, Security Level medium.

The script prints `Edge__Secret=…` at the end. Keep it.

## 4. Lock the API to Cloudflare (Render)

Render → the API service → Environment → add `Edge__Secret` with the value the script printed → save (it redeploys).
From then on the API refuses (403) any request that did not come through Cloudflare, so the `onrender.com` address is closed and the rate
limits count each visitor by their real address (`CF-Connecting-IP`) instead of Cloudflare's. `/health` stays open for Render's checks.

Order matters: run the script first so Cloudflare is already adding the header. To undo, delete `Edge__Secret` in Render.

## If the app says "Could not load" but the site opens

On the phone, open `https://zenigma-api.ska97homelab.uk/time` in the browser. A date means the API is fine. A Cloudflare "checking your browser" page means a
challenge is hitting the API (run the script again, it now skips them). A blank 403 means the edge secret is not being added (see step 4). Then look at
Security → Events for the same minute: the Service column names the rule.

## 5. Check

1. Open the site in a private window: it loads, and Security → Events shows no new blocks for `/ngsw.json`.
2. `curl -i https://zenigma-api.ska97homelab.uk/time` returns 200. The same path on your `onrender.com` address returns 403.
3. On a phone with the old copy: open the app, wait two minutes or tap Settings → Reload fresh, and the version in About changes.

## What the API does by itself (no Cloudflare needed)

Concurrency cap, per-user and per-address limits, a tighter limit on sign-in, email, circle codes and error reports, a per-user limit on every write
(150 a minute) and on coin actions (40 a minute), and account lockout after 8 failed passwords.
