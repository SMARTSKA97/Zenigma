<div align="center">

<img src="apps/web/public/icons/icon-192x192.png?v=2" width="96" height="96" alt="Zenigma" />

# Zenigma

**Daily puzzles and brain games that work anywhere, even offline.**

Crowns · Eclipse · Sudoku · Zipline · Patchwork · Word Guess · 25 mind games · streaks · leaderboards

[![CI](https://github.com/SMARTSKA97/Zenigma/actions/workflows/ci.yml/badge.svg)](https://github.com/SMARTSKA97/Zenigma/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/SMARTSKA97/Zenigma?label=Android&color=3ddc84&logo=android&logoColor=white)](https://github.com/SMARTSKA97/Zenigma/releases)
[![Play on the web](https://img.shields.io/badge/Play-on%20the%20web-6d5dfc?logo=googlechrome&logoColor=white)](https://zenigma.ska97homelab.uk)
![Built with](https://img.shields.io/badge/built%20with-Angular%20%C2%B7%20.NET%20%C2%B7%20PostgreSQL-0f1618)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[**Play now**](https://zenigma.ska97homelab.uk) · [**Download for Android**](https://github.com/SMARTSKA97/Zenigma/releases) · [**iPhone and iPad**](#iphone-and-ipad) · [Roadmap](docs/ROADMAP.md)

</div>

<table>
  <tr>
    <td><img src="docs/screenshots/home-light.png" alt="Home" /></td>
    <td><img src="docs/screenshots/games-light.png" alt="All games" /></td>
    <td><img src="docs/screenshots/sudoku-light.png" alt="Sudoku" /></td>
    <td><img src="docs/screenshots/mind-light.png" alt="Mind training" /></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/home-dark.png" alt="Home, dark" /></td>
    <td><img src="docs/screenshots/challenges-dark.png" alt="Challenges, dark" /></td>
    <td><img src="docs/screenshots/crowns-dark.png" alt="Crowns, dark" /></td>
    <td><img src="docs/screenshots/games-dark.png" alt="All games, dark" /></td>
  </tr>
</table>

## Why Zenigma

- **Plays offline, always.** Every puzzle ships with the app or is generated on the device. The server only adds the daily
  boards, leaderboards and sync, and it is never needed to play.
- **A new daily set, the same for everyone.** One puzzle per game each (India) day, a daily mind set of six games, and extra
  word dailies. Finish them all to keep your streak.
- **Endless levels and practice.** Easy to Insane, with a level map, hints that teach (“Show me” plays the next step) and a
  coach that explains the mistake.
- **Mind training.** 25 short games across memory, attention, speed, maths, language and logic, with a skills dashboard
  and an optional, private comparison with other players.
- **Fair and light.** No ads, no tracking, nothing locked behind a payment. Tips only help pay the server.

## Games

| | |
|---|---|
| **Logic** | Crowns, Eclipse, Zipline, Patchwork |
| **Sudoku** | Classic, mini and special rules, Easy to Insane |
| **Words** | Word Guess, Pindown, Chain Link, Word Climb, Wend |
| **Mind** | Comet Slice, Switchyard, Echo Sequence, Grid Recall, Number Recall, Pair Match, Colour Clash, Odd One Out, Quick Sums and more |
| **Around the games** | Daily streak with a shareable card, weekly and monthly challenges that earn hints, badges, circles and leaderboards |

## Get the app

### Android

Download the latest `.apk` from the [Releases page](https://github.com/SMARTSKA97/Zenigma/releases) and open it. The app
checks for new versions itself and installs them with one tap.

### iPhone and iPad

There is no App Store app: Zenigma is an installable web app that looks and feels like one.

1. Open [zenigma.ska97homelab.uk](https://zenigma.ska97homelab.uk) in **Safari**.
2. Tap **Share**, then **Add to Home Screen**, then **Add**.
3. Open Zenigma from your Home Screen. It runs full screen and works offline.

Updates arrive by themselves; tap **Reload** when “Update ready” appears. The app has a picture guide under
**Settings → Install**. Sign in to bring back your results: the installed app keeps its storage apart from Safari.

### Web

Play in any modern browser at [zenigma.ska97homelab.uk](https://zenigma.ska97homelab.uk), and use your browser’s
**Install** button to add it to your desktop or phone.

## How it works

![How Zenigma fits together](docs/img/architecture.png)

<sub>Diagram source: [`docs/img/architecture.mmd`](docs/img/architecture.mmd)</sub>

- **Offline-first.** Results are events in an on-device log. They sync to the server when a connection exists, are applied
  once, and come back to any device you sign in on.
- **One codebase.** The same Angular app is the website, the installable web app and the Android app (Capacitor).
- **Shared engines.** The TypeScript and C# game engines are checked against the same test vectors in `tests/vectors`.
- **Gentle on the server.** The app never wakes the server just by opening; boards, the daily and sign-in do.

## Roadmap

| When | What |
|---|---|
| **Now (0.24)** | “Show me” hints, streak share card, tablet-style Settings, UPI pay with QR, updates and install guide for iPhone and iPad |
| **Next** | More mind games, blocked cells, iPhone streak reminders, per-game results synced to your account |
| **Later** | Android widget, Word Guess in more languages, level editor and community levels, Google Play, a native iOS app with a widget |

The full plan, and what will never happen (ads, tracking, paid rankings), is in [docs/ROADMAP.md](docs/ROADMAP.md).

## Repository

| Path | What |
|---|---|
| `apps/web` | Angular 22 app (also the Android UI) and the Capacitor Android project |
| `apps/api` | .NET 10 API: auth, sync, leaderboards, server clock |
| `db/migrations` | Flyway SQL migrations (the only way the schema changes) |
| `tools/generators` | Puzzle and level generators |
| `tests/vectors` | Shared test vectors for the TypeScript and C# game engines |
| `mobile/release-notes` | One `<version>.md` per Android release |
| `docs` | [Deployment](docs/DEPLOYMENT.md), [operations](docs/OPERATIONS.md), [scaling](docs/SCALING.md), [security](docs/SECURITY.md), [roadmap and ideas](docs/ROADMAP.md) |

## Develop

Secrets live in a git-ignored `.env` file, never in source. Start from the template:

```bash
cp .env.example .env        # fill in the blanks; generate values with: openssl rand -base64 48
docker compose up -d db                 # local Postgres (uses POSTGRES_* from .env)
docker compose run --rm migrate         # apply db/migrations with Flyway

# API (http://localhost:5080): reads .env automatically in development
cd apps/api/Zenigma.Api && dotnet run --urls http://localhost:5080

# Web (http://localhost:4200)
cd apps/web && npm ci && npx ng serve
```

The API’s `ConnectionStrings__Default` password must match `POSTGRES_PASSWORD`. In production the same names are set as
environment variables and GitHub secrets; see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

**Tests:** `dotnet test apps/api/Zenigma.slnx` (set `ZENIGMA_TEST_DB` in `.env` to run the database tests) and
`cd apps/web && npx ng test`. CI runs both, the puzzle generators, an Android debug build and a dependency audit on every push.

## Support

Zenigma is free, has no ads and plays offline. The server, database, domain and email service are paid for by one person.
A tip of any size keeps the daily puzzles and leaderboards online. **It unlocks nothing**: it is only a thank-you, and
supporters get a badge and a place on the wall of thanks.

<table>
  <tr>
    <td align="center" width="200"><img src="docs/img/upi-qr.png" width="160" alt="UPI QR code" /><br/><sub>Scan with any UPI app<br/><code>ska97@ptaxis</code></sub></td>
    <td>
      <a href="https://github.com/sponsors/SMARTSKA97"><img src="https://img.shields.io/badge/Sponsor-GitHub-db61a2?logo=githubsponsors&logoColor=white" alt="GitHub Sponsors" /></a>
      <a href="https://buymeacoffee.com/smartska97"><img src="https://img.shields.io/badge/Buy%20me%20a-coffee-ffdd00?logo=buymeacoffee&logoColor=black" alt="Buy me a coffee" /></a>
      <br/><br/>
      In the app, open <b>Settings → Contributors</b> to pay with a UPI app, then tap “Yes, it did” so the thank-you
      switches on.<br/><br/>
      No money? <b>Star the repo</b>, tell a friend, report a bug or send an idea. That helps just as much.
    </td>
  </tr>
</table>

## Contributing

Zenigma welcomes help, from a typo to a new game. Read [CONTRIBUTING.md](CONTRIBUTING.md) for the ways to help, how to
send a pull request and how to become a collaborator, and use the [issue forms](https://github.com/SMARTSKA97/Zenigma/issues/new/choose)
for bugs and ideas. Security problems go privately to [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © 2026 Subhrajit Karmakar
