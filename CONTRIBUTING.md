# Contributing to Zenigma

Thank you for wanting to help. Zenigma is built by one person in spare time, so every bit of help is noticed.

## Ways to help

| You are good at | Start here |
|---|---|
| Playing | Report a bug or an idea with the [issue forms](https://github.com/SMARTSKA97/Zenigma/issues/new/choose) |
| Puzzle design | Propose a variant or a new mind game: describe the rules and what a daily would look like |
| Angular or TypeScript | Issues labelled `good first issue`; screens live in `apps/web/src/app/features` |
| .NET or SQL | The API in `apps/api` and the migrations in `db/migrations` |
| Android or iOS | The Capacitor project in `apps/web/android`; a native widget is on the [roadmap](docs/ROADMAP.md) |
| Writing and translation | `docs/`, release notes and the rules pages |
| Money | See [Support](README.md#support): it pays for the server |

## Set up

Follow [Develop](README.md#develop) in the README. Then:

```bash
cd apps/web
npm ci
npx ng test --watch=false     # unit tests
npx ng build                  # production build
```

## Pull requests

1. Open an issue first for anything bigger than a small fix, so we agree on the direction.
2. Branch from `main` (one topic per branch), keep the change small and focused.
3. Add or update tests. CI must be green: web tests and build, API tests, puzzle generators, Android debug build, dependency audit.
4. Keep the app **offline-first**: playing must never need the server.
5. House rules: hints and anything that could be bought never touch a ranking, and there are no ads or tracking.

## Becoming a collaborator

Contributors who send a few merged pull requests, or who take care of one area (a game, the API, translations), are invited
as collaborators with write access. Say hello in an issue or in a pull request to start.

## Conduct

Be kind and assume good intent. Harassment is not tolerated. Security problems go to [SECURITY.md](SECURITY.md), privately.
