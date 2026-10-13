# Ideas and roadmap

✅ = built and shipped (or in the next release). ⬜ = still to do. 🆕 = newly added idea.
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
| 0.20.0 | ✅ Zip Walls and Blocked cells, Patches Shapes only (see `docs/CHALLENGES.md` for all challenge ideas), five new mind games, LinkedIn-style Patches, leave-game guard, dark-theme audit, more haptics, smoother navigation, strict practice (three strikes) |

## Hints economy

### The currency
- ✅ One shared balance of Hints, a local copy so it works offline, start with 3, free sources capped at 10.
- ✅ Hint behaviour per game (Queens, Tango, Sudoku, Zip, Word Guess), with a short "why".
- ✅ **Server-side balance** (0.19.0): a ledger on the server, idempotent by entry id, the first sync adopts the device balance. Prerequisite for purchases.
- ⬜ Reconcile edge cases: two devices spending at once (today the server never goes below zero, the loser sees a small correction).

### Free ways to earn
- ✅ Daily wheel, every 10th level, streak and comeback gifts.
- ✅ Weekly, weekend and monthly challenges pay hints (0.18.0), collected up to the cap and the rest waits.
- ⬜ First win of the day: 1-in-3 chance of a hint.
- ⬜ Streak milestone hints at 7 and 30 days (freezes exist, hints do not yet).

### Later (needs real players first)
- ⬜ Rewarded ads, hint packs, "Zenigma Plus". Ads are out of scope for now.
- ⬜ Google Play: AAB, data-safety form (privacy policy and account deletion already exist).

## Challenges and Mind

- ✅ Challenges hub with tabs Puzzles | Mind | Goals (0.19.0), replacing Daily.
- ✅ 15 mind games across six skills, each with its own best, and a daily mind set (3 games, 3 skills, same for everyone, India date).
- ✅ Mind dashboard: brain map, radar, overall mark, per-skill detail.
- ✅ Compare by age group and gender, opt-in, a group needs 5 players before any average shows.
- ⬜ 🆕 **Mind leaderboard** for the daily set, ranked by total points.
- ⬜ 🆕 **Mind badges** (7-day mind streak, all six skills above 60, Brain 100).
- ⬜ 🆕 **Skill trend**: a small line of each mark over the last 30 days.
- ⬜ 🆕 **Weakest-skill nudge**: "Your attention is lowest, try Odd One Out".
- ⬜ 🆕 **Mind age**: a playful single number from the marks, clearly labelled as entertainment.
- ✅ Mind games grew to 20 (Mental Turn, Number Sort, Dot Count, Opposites, Word Recall added in 0.20.0).
- ⬜ More mind games: Comet Slice and others (see Coming soon in Practice).
- ⬜ Ranked puzzle of the week for the featured level, by fewest mistakes.

## Games

- ✅ Sudoku tiers Easy to Insane, now also for Queens, Tango, Zip and Patches (0.19.0).
- ✅ Sudoku kinds: Diagonal, Windoku, Disjoint Groups, Anti-Knight, Killer, Thermo, Jigsaw, Arrow, Sandwich, Consecutive, Even-Odd.
- ✅ Speed round, featured level of the week, 1000 new levels per track every week.
- ⬜ 🆕 Sudoku kinds: **Anti-King**, **Renban**, **Little Killer**, **Kropki**, **Non-consecutive**.
- ✅ Patches variant with hidden numbers (shape only). ⬜ Numbers-only, blocked cells.
- ⬜ Daily "Perfect" badge: every daily in a day, no mistakes, no hints.
- ⬜ 🆕 **Tutorials**: a 20-second interactive first level per game.
- ⬜ 🆕 **Level editor / community levels** (long term).

## Accounts, connection and sync

- ✅ Profile page with permissions (what is shared and why), display name, age group, gender, hide-name option.
- ✅ Google sign-in on the web (set `Google__ClientId` on Render).
- ✅ Offline mode switch and warm-up loader; daily challenges pause offline, everything else works.
- ⬜ 🆕 **Google sign-in on Android** needs a native plugin (the WebView cannot run Google Identity Services). The button is hidden there until then.
- ⬜ 🆕 Link or unlink Google from an existing email account in Profile.
- ⬜ 🆕 Export my data (JSON) next to Delete account.
- ⬜ Offline daily: download tomorrow's puzzle ahead of time.

## UX

- ✅ Undo and redo, pause, result screen with percentile, friends strip, weekly recap, themes, keyboard play, predictive back, resume where you left, haptic strengths, larger numbers, spoken board descriptions.
- ✅ Practice reorganised: filter by kind, Mind has its own page (0.19.0).
- ✅ Update sheet and Version history in sections: New, Improved, Fixed, Coming up (0.19.0).
- ⬜ Home-screen widget with streak and today's dailies.
- ⬜ Wide-screen layout (board centre, rules and leaderboard beside it).
- ⬜ 🆕 **Reminders** at a time you choose (local notifications, no server needed).
- ⬜ 🆕 **Quiet mode**: hide streaks and timers for people who find them stressful.
- ⬜ 🆕 **Language packs** for Word Guess beyond English.

## Engineering and growth

- ✅ CI: web, API with Flyway and xUnit, puzzle generators with verification and vectors, Android build.
- ⬜ 🆕 **Repo growth**: weekly packs add about 1000 levels per track each week. Plan: keep recent packs in git, move old ones to release assets or object storage, and have the app fetch them by version.
- ⬜ 🆕 The weekly generation job now covers many more tracks; watch its run time and split it per game if it nears the limit.
- ⬜ 🆕 The "spun today" marker for the wheel is local only; move it to the server balance so a second device cannot spin again.
- ⬜ 🆕 Old queens/tango/zip/patches progress restarts under the new tiers; consider migrating it by mapping old level numbers to tiers.
- ⬜ 🆕 Observability: a small error report endpoint, no third-party tracking.
