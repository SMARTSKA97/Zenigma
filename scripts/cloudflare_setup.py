#!/usr/bin/env python3
"""Sets up Cloudflare for Zenigma in one repeatable step (Free plan friendly, standard library only).

  export CF_API_TOKEN=...            # see docs/CLOUDFLARE.md for the four permissions it needs
  python scripts/cloudflare_setup.py                 # shows what it would change (nothing is sent)
  python scripts/cloudflare_setup.py --apply         # makes the changes
  python scripts/cloudflare_setup.py --apply --bot-fight off   # also turns Bot Fight Mode off (see the doc before you do)

It only touches rules whose description starts with "zenigma:", so anything else you set up by hand is kept.
Running it again updates its own rules in place.
"""
import argparse, json, os, secrets, sys, urllib.error, urllib.request

API = os.environ.get("CF_API_BASE", "https://api.cloudflare.com/client/v4")
TAG = "zenigma:"


def call(token, method, path, body=None, ok_404=False):
    req = urllib.request.Request(API + path, method=method, headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data=data, timeout=30) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        if e.code == 404 and ok_404:
            return {"result": {"rules": []}}
        sys.exit(f"Cloudflare said {e.code} for {method} {path}: {e.read().decode()[:600]}")


def merge(existing, ours):
    kept = [r for r in existing if not str(r.get("description", "")).startswith(TAG)]
    return kept + ours


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--zone", default="ska97homelab.uk", help="the Cloudflare zone (the domain)")
    ap.add_argument("--web", default="zenigma.ska97homelab.uk", help="hostname of the web app")
    ap.add_argument("--api", default="zenigma-api.ska97homelab.uk", help="hostname of the API")
    ap.add_argument("--edge-secret", default=os.environ.get("EDGE_SECRET"), help="shared secret (made up if not given)")
    ap.add_argument("--api-burst", type=int, default=60, help="requests allowed per 10 seconds from one address to the API")
    ap.add_argument("--bot-fight", choices=["leave", "off", "on"], default="leave")
    ap.add_argument("--apply", action="store_true")
    a = ap.parse_args()

    token = os.environ.get("CF_API_TOKEN")
    if not token:
        sys.exit("Set CF_API_TOKEN first (docs/CLOUDFLARE.md says how).")
    secret = a.edge_secret or secrets.token_urlsafe(32)

    web, api = f'(http.host eq "{a.web}")', f'(http.host eq "{a.api}")'
    static = ' or '.join([
        'http.request.uri.path in {"/ngsw.json" "/ngsw-worker.js" "/index.html" "/manifest.webmanifest" "/safety-worker.js" "/"}',
        'starts_with(http.request.uri.path, "/assets/")',
        'starts_with(http.request.uri.path, "/icons/")',
        'starts_with(http.request.uri.path, "/levels/")',
        'starts_with(http.request.uri.path, "/fonts/")',
    ])
    junk = ('(lower(http.request.uri.path) contains "/wp-" or lower(http.request.uri.path) contains "/.env" or lower(http.request.uri.path) contains "/.git" '
            'or ends_with(lower(http.request.uri.path), ".php") or lower(http.request.uri.path) contains "/phpmyadmin" or ends_with(lower(http.request.uri.path), ".sql"))')

    custom = [
        {"description": TAG + " let the app fetch its own update files", "expression": f"{web} and ({static})", "action": "skip",
         "action_parameters": {"products": ["bic", "securityLevel", "uaBlock"]}, "logging": {"enabled": True}},
        {"description": TAG + " block probes for files we never serve", "expression": junk, "action": "block"},
        {"description": TAG + " API calls need a user agent", "expression": f'{api} and http.user_agent eq ""', "action": "block"},
    ]
    ratelimit = [{
        "description": TAG + " API burst limit per address",
        "expression": api, "action": "block",
        "ratelimit": {"characteristics": ["ip.src", "cf.colo.id"], "period": 10, "requests_per_period": a.api_burst, "mitigation_timeout": 10},
    }]
    transform = [{
        "description": TAG + " mark API requests as coming through Cloudflare",
        "expression": api, "action": "rewrite",
        "action_parameters": {"headers": {"X-Zenigma-Edge": {"operation": "set", "value": secret}}},
    }]
    settings = {"always_use_https": "on", "min_tls_version": "1.2", "browser_check": "on", "security_level": "medium"}

    plan = [
        ("http_request_firewall_custom", custom),
        ("http_ratelimit", ratelimit),
        ("http_request_late_transform", transform),
    ]
    print(f"Zone {a.zone}  web {a.web}  api {a.api}")
    for phase, rules in plan:
        print(f"\n[{phase}]")
        for r in rules:
            print(f"  - {r['action']:8} {r['description']}")
    print("\n[settings]", ", ".join(f"{k}={v}" for k, v in settings.items()))
    if a.bot_fight != "leave":
        print(f"[bot fight mode] {a.bot_fight}")
    if not a.apply:
        print("\nNothing was changed. Run again with --apply to make these changes.")
        return

    zones = call(token, "GET", f"/zones?name={a.zone}")["result"]
    if not zones:
        sys.exit(f"No zone called {a.zone} on this token.")
    zid = zones[0]["id"]
    for phase, rules in plan:
        path = f"/zones/{zid}/rulesets/phases/{phase}/entrypoint"
        cur = call(token, "GET", path, ok_404=True)["result"].get("rules") or []
        if phase == "http_request_late_transform" and not a.edge_secret:
            # Running again keeps the secret that is already in place (and already in Render) unless you pass a new one.
            for r in cur:
                old = str(r.get("description", "")).startswith(TAG) and r.get("action_parameters", {}).get("headers", {}).get("X-Zenigma-Edge", {}).get("value")
                if old:
                    secret = old
                    rules[0]["action_parameters"]["headers"]["X-Zenigma-Edge"]["value"] = old
        keep = [{k: v for k, v in r.items() if k not in ("last_updated", "version")} for r in merge(cur, [])]
        call(token, "PUT", path, {"rules": keep + rules})
        print(f"updated {phase}")
    for key, value in settings.items():
        call(token, "PATCH", f"/zones/{zid}/settings/{key}", {"value": value})
        print(f"set {key}")
    if a.bot_fight != "leave":
        call(token, "PUT", f"/zones/{zid}/bot_management", {"fight_mode": a.bot_fight == "on"})
        print(f"bot fight mode {a.bot_fight}")
    print("\nDone. Put this in Render as the environment variable Edge__Secret (only after this run, so the API accepts the header):")
    print(f"  Edge__Secret={secret}")


if __name__ == "__main__":
    main()
