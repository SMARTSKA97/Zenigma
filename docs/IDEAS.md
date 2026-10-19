# Ideas and roadmap

✅ = built and shipped (or in the next release). ❌ = decided against, with the reason. 📝 = plan written, not needed yet. ⬜ = still to do. 🆕 = newly added idea.
The standing rule: **hints and anything that could be bought never touch a ranking** (dailies and leaderboards stay hint-free).

## Status at a glance

| Release | What landed |
| --- | --- |
| 0.14.0 | ✅ Coaching hints, free Check, daily wheel, tenth-level hints, 2-star cap for hinted levels, share card, screen-awake, daily screenshot block |
| 0.15.0 | ✅ Word Guess hints, pause in Practice, badges, streak and comeback gifts, per-game streak freezes |
| 0.16.0 | ✅ Sudoku difficulty tiers, Practice Play / Coming soon, redesigned Settings, larger numbers |
| 0.17.0 | ✅ Weekly level packs, Diagonal / Windoku / Disjoint / Anti-Knight, speed round, challenge links, circle seasons, themes, haptics, Home extras, redo and keyboard play |
| 0.18.0 | ✅ Weekly/weekend/monthly challenges, more badges, 15 mind games, featured level of the week, seven more Sudoku kinds |
| 0.19.0 | ✅ Challenges hub, daily mind set, Mind dashboard, profile and Google sign-in, offline mode, warm-up loader, server hint balance, tiers for every logic game |
| 0.20.0 | ✅ Zip Walls and Blocked cells, Patches Shapes only (see `docs/CHALLENGES.md` for all challenge ideas), five new mind games, LinkedIn-style Patches, leave-game guard, dark-theme audit, more haptics, smoother navigation, strict practice, blind Sudoku, hide the timer, mind badges, weakest-skill nudge |

## Hints economy

### The currency
- ✅ One shared balance of Hints, a local copy so it works offline, start with 3, free sources capped at 10.
- ✅ Hint behaviour per game (Queens, Tango, Sudoku, Zip, Word Guess), with a short "why".
- ✅ **Server-side balance** (0.19.0): a ledger on the server, idempotent by entry id, the first sync adopts the device balance. Prerequisite for purchases.
- ✅ Two devices spending at once: the server never goes below zero and now tells the device how many spends it could not cover, so the app says why the balance dropped (0.20.0).

### Free ways to earn
- ✅ Daily wheel, every 10th level, streak and comeback gifts.
- ✅ Weekly, weekend and monthly challenges pay hints (0.18.0), collected up to the cap and the rest waits.
- ✅ First win of the day: 1-in-3 chance of a hint.
- ✅ Streak milestone hints at 7 and 30 days.

### Later (needs real players first)
- ✅ Built for many players at once (0.20.0): batched sync, cached shared leaderboards, indexes, request ceilings, connection tuning. See docs/SCALING.md for what to set on Render and Neon.
- ⬜ Rewarded ads, hint packs, "Zenigma Plus". Ads are out of scope for now.
- ✅ Google Play prep: signed AAB attached to every release, data-safety answers and the Console checklist are in docs/PLAY_STORE.md. ✅ The in-app APK updater hides itself when the app was installed from Play. ⬜ Left for you: the Play Console steps.

## Challenges and Mind

- ✅ Challenges hub with tabs Puzzles | Mind | Goals (0.19.0), replacing Daily.
- ✅ 15 mind games across six skills, each with its own best, and a daily mind set (3 games, 3 skills, same for everyone, India date).
- ✅ Mind dashboard: brain map, radar, overall mark, per-skill detail.
- ✅ Compare by age group and gender, opt-in, a group needs 5 players before any average shows.
- ✅ **Mind leaderboard** for the daily set, today and this week, in the Mind tab (0.20.0). Points are reported by the app, so it is labelled as for fun.
- ✅ **Mind badges** (0.20.0): All-rounder, Whole gym, mind streaks. ✅ Brain 100 (0.20.0).
- ✅ **Skill trend**: a small line of each skill over the last 30 days with a play (0.20.0).
- ✅ **Weakest-skill nudge** on the Mind page (0.20.0).
- ✅ **Mind age** (0.20.0): a playful single number from the marks, clearly labelled as entertainment.
- ✅ Mind games grew to 20 (Mental Turn, Number Sort, Dot Count, Opposites, Word Recall added in 0.20.0), then to 25 (Chain Link, Pinpoint, Crossclimb, Wend, Comet Slice in 0.22.0).
- ⬜ More mind games (see Coming soon in Practice, if any are listed).
- ✅ Ranked puzzle of the week: the featured level has a weekly board (fewest mistakes, then fastest, no hints), under it on the Challenges page (0.20.0). Mistakes are reported by the app, so it is for fun.

## Games

- ✅ Sudoku tiers Easy to Insane, now also for Queens, Tango, Zip and Patches (0.19.0).
- ✅ Sudoku kinds: Diagonal, Windoku, Disjoint Groups, Anti-Knight, Killer, Thermo, Jigsaw, Arrow, Sandwich, Consecutive, Even-Odd.
- ✅ Speed round, featured level of the week, 1000 new levels per track every week.
- ✅ Sudoku kinds **Anti-King** and **Non-consecutive** (0.20.0).
- ✅ Sudoku kind **Renban** (0.20.0).
- ✅ Sudoku kinds **Little Killer** and **Kropki** (0.20.0).
- ✅ Patches variants: shapes only, and numbers only (0.20.0). ⬜ Blocked cells.
- ✅ **Perfect day** badge: every daily game solved in one day (0.20.0). Dailies have no hints, and mistakes are not recorded, so "perfect" means complete.
- ✅ **Tutorials**: the first time you open level 1 of a game, every move is followed by a free coach card with the next step (nothing is spent, the level still counts as clean). Skip it any time (0.20.0).
- ⬜ 🆕 **Level editor / community levels** (long term).

## Accounts, connection and sync

- ✅ Profile page with permissions (what is shared and why), display name, age group, gender, hide-name option.
- ✅ Google sign-in on the web (set `Google__ClientId` on Render).
- ✅ Offline mode switch and warm-up loader; daily challenges pause offline, everything else works.
- ✅ 🆕 **Google sign-in on Android** (0.21.0): native account picker via Credential Manager. ⬜ Needs the Android OAuth client with the signing SHA-1 (see docs/DEPLOYMENT.md).
- ✅ Link or unlink Google from an existing email account in Profile.
- ✅ Export my data (JSON), in Settings (0.20.0).
- ❌ Offline daily: decided against. Dailies are timed and checked by the server so times are fair; handing out tomorrow's puzzle early, or accepting an offline time, would break that. Practice, Mind and Word Guess practice already work offline.

## UX

- ✅ Undo and redo, pause, result screen with percentile, friends strip, weekly recap, themes, keyboard play, predictive back, resume where you left, haptic strengths, larger numbers, spoken board descriptions.
- ✅ Practice reorganised: filter by kind, Mind has its own page (0.19.0).
- ✅ Update sheet and Version history in sections: New, Improved, Fixed, Coming up (0.19.0).
- ⬜ Home-screen widget with streak and today's dailies.
- ✅ Wide-screen layout: board plus a side panel from 900px, and the rules beside it from 1250px (0.20.0).
- ✅ **Reminders** at a time you choose (local notifications, no server needed).
- ✅ **Quiet mode**: Hide the timer (0.20.0). ✅ Hide streaks too (0.20.0).
- ⬜ 🆕 **Language packs** for Word Guess beyond English.

## Engineering and growth

- ✅ CI: web, API with Flyway and xUnit, puzzle generators with verification and vectors, Android build.
- 📝 **Repo growth** (plan written in docs/LEVELS.md, start at about 300 MB): weekly packs add about 1000 levels per track each week. Plan: keep recent packs in git, move old ones to release assets or object storage, and have the app fetch them by version.
- 📝 The weekly generation job: split instructions are in docs/LEVELS.md; a full run is about 10 minutes.
- ✅ The wheel's prize is queued under a per-day id (`wheel:<date>`), and the server counts each id once, so a second device cannot be paid twice (0.20.0). The device that loses sees its balance correct on the next sync.
- ❌ Old queens/tango/zip/patches progress migration: decided against. Old level numbers were a single difficulty ramp with no stable mapping to the five tiers, so a guess would either skip levels or repeat them. Progress under the tiers starts fresh; badges and totals already count what was cleared.
- ✅ Observability: `POST /telemetry/error` writes a short client crash report to the API log (rate limited, no account or device id, nothing stored). A Settings switch turns it off (0.20.0).

## Done: security hardening (phase 41)
OWASP Top 10 pass: headers/CSP, token reuse detection, Google pre-hijack fix, logging, CodeQL, Dependabot, pinned actions. See docs/SECURITY.md. Next: email verification + forgot password, MFA.

## Done: email, calmer errors, lazy sync (phase 42)
Forgot password and email confirmation via Brevo (docs/DEPLOYMENT.md), fixed message strip under the board, slower mistake flag for Queens/Tango, sync no longer wakes a sleeping server on every start or result.

## Done: daily hints, Word Guess feel, Patches gutter (phase 43)
Server-counted daily hints (V11), Word Guess haptics/animation fixes (native ignores the OS reduced-motion flag), Patches spacing.

## Done: streak alert (phase 44)
One local notification 3 hours before the daily rollover when a streak is at risk (set from the Daily tab). Next ideas: friend challenges, weekly recap card, invite links.

## Done: streak widget (phase 45)
Android home-screen widget (StreakWidgetProvider/Plugin); numbers pushed from the Daily tab and after a daily is solved.

## Done: widget sizes, wake cover, auto-start dailies, notification prompt (phase 46)
Hint fairness penalty removed for now (hints recorded only); puzzle daily hints are offline.

## Done: cached boards (phase 48)
Ranks show the last board at once and refresh quietly; boards are reused for 60 s on the device and cleared when a daily result changes them.

## Done: lighter load (phase 49)
- Offline results sync on their own: 90 s after the last result (one wake per play session), when the app is left or reopened, retry with growing delays; stale limit 6 h.
- ETag + `Cache-Control: private` on boards, stats and the daily hub (bodyless 304 when unchanged).
- Home and Badges draw from saved stats and community numbers and never wake the server; they refresh when it is awake.
- Stats read only needed columns; V12 indexes; mind-daily events older than 180 days removed by `SyncEventRetention` (`Retention__MindDays`).
- `loadtest/k6.js` and `docs/OPERATIONS.md` (Brevo steps, Render and Neon usage, `pg_stat_statements`). `Email__DailyBudget` lets Zenigma share Brevo's 300 a day.

## Done: Chain Link (phase 50)
- Mind game (Language): compound-word chains from a built-in pair list (`games/mind/chain-link-data.ts`), 2 to 6 hidden words, any valid word that joins both neighbours is accepted. Add pairs to the list to grow it.

## Done: word dailies and Wend rebuilt (phase 54)
- Wend follows LinkedIn: 5x5 grid with 7 grey wall blocks, four words (3, 4, 5, 6 letters) traced through neighbouring letters, every letter used once, one solution per board (`wend-engine.ts`: path partition board maker, `countSolutions` against the full word list), a real word on the wrong tiles is rejected; word lists built by `tools/generators/words/build-wend.mjs`.
- Dailies for Pinpoint, Chain Link, Crossclimb, Wend: client-seeded by IST date (`word-daily.ts`, route `/daily-word/:game`, panel in the Puzzles tab), event `wdaily.completed`, board `/leaderboards/word-daily` (V13 index). Not server-validated, so not part of streaks or the widget. Comet Slice is arcade (Slice Fire style: collect fires, a skull ends the run, 45 seconds, combos) and has no daily.

## Audit follow-ups (from an outside review, October 2026)
- Done: README, SECURITY and roadmap counts agree (6 main games, 25 mind games, email flows need Brevo env vars).
- Done: sync edge-case tests on the API (second device, cursor from the future, parallel retry of one batch, repeated event in a batch, refused token) and the web client (failed page keeps the last cursor, a stuck or smaller cursor never loops or moves back, own events returning on pull); the pull loop now stops when the cursor does not advance.
- Open, worth doing: end-to-end test of offline play, reconnect and sync (Playwright in CI); alerts on 5xx/slow/storage; restore drill for Neon backups and a keystore backup; split `puzzle-page.ts` only where responsibilities are tangled; accessibility pass (keyboard, screen reader, reduced motion); a simple D1/D7 and per-game completion view.
- Not now: more mini-games, community editors, monetisation.

## Next
- All the Coming soon games are live now (Pinpoint, Crossclimb, Wend, Comet Slice). Crossclimb and Wend use the Word Guess lists; Chain Link and Pinpoint have their own data files to grow.
- Pinpoint is live (`games/mind/pinpoint-data.ts`, about 75 categories; add more there). Word games share the Mind screen (`/mind/<id>`) and skill 'language'.
- "Offline ready" badge; pre-cache level packs on Wi-Fi when idle; compress share images.
- Alerts on 5xx and slow responses; run the k6 test and tune from real numbers; small VPS once past ~500 daily users.
- Cache-Control for the daily puzzle data once it is served without a login.
