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
- ⬜ Reconcile edge cases: two devices spending at once (today the server never goes below zero, the loser sees a small correction).

### Free ways to earn
- ✅ Daily wheel, every 10th level, streak and comeback gifts.
- ✅ Weekly, weekend and monthly challenges pay hints (0.18.0), collected up to the cap and the rest waits.
- ✅ First win of the day: 1-in-3 chance of a hint.
- ✅ Streak milestone hints at 7 and 30 days.

### Later (needs real players first)
- ⬜ Rewarded ads, hint packs, "Zenigma Plus". Ads are out of scope for now.
- ⬜ Google Play: AAB, data-safety form (privacy policy and account deletion already exist).

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
- ✅ Mind games grew to 20 (Mental Turn, Number Sort, Dot Count, Opposites, Word Recall added in 0.20.0).
- ⬜ More mind games: Comet Slice and others (see Coming soon in Practice).
- ✅ Ranked puzzle of the week: the featured level has a weekly board (fewest mistakes, then fastest, no hints), under it on the Challenges page (0.20.0). Mistakes are reported by the app, so it is for fun.

## Games

- ✅ Sudoku tiers Easy to Insane, now also for Queens, Tango, Zip and Patches (0.19.0).
- ✅ Sudoku kinds: Diagonal, Windoku, Disjoint Groups, Anti-Knight, Killer, Thermo, Jigsaw, Arrow, Sandwich, Consecutive, Even-Odd.
- ✅ Speed round, featured level of the week, 1000 new levels per track every week.
- ✅ Sudoku kinds **Anti-King** and **Non-consecutive** (0.20.0).
- ✅ Sudoku kind **Renban** (0.20.0).
- ✅ Sudoku kinds **Little Killer** and **Kropki** (0.20.0).
- ✅ Patches variant with hidden numbers (shape only). ⬜ Numbers-only, blocked cells.
- ✅ **Perfect day** badge: every daily game solved in one day (0.20.0). Dailies have no hints, and mistakes are not recorded, so "perfect" means complete.
- ⬜ 🆕 **Tutorials**: a 20-second interactive first level per game.
- ⬜ 🆕 **Level editor / community levels** (long term).

## Accounts, connection and sync

- ✅ Profile page with permissions (what is shared and why), display name, age group, gender, hide-name option.
- ✅ Google sign-in on the web (set `Google__ClientId` on Render).
- ✅ Offline mode switch and warm-up loader; daily challenges pause offline, everything else works.
- ⬜ 🆕 **Google sign-in on Android** needs a native plugin (the WebView cannot run Google Identity Services). The button is hidden there until then.
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
