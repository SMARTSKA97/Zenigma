# Ideas: hints economy and UX

## Hints for practice (and a path to monetisation)

**Principle:** hints exist only in practice. Dailies and leaderboards stay hint-free, so nothing that can be bought ever touches a ranking. That keeps the game fair and keeps any future monetisation easy to defend.

### The currency
- One balance, **Hints** (a lightbulb), shared across all games. Stored per account (synced), with a local copy so it works offline.
- Start every player with **3**. Cap the balance at **10** for free sources (paid packs can exceed it), so hoarding never trivialises levels.
- A hint costs 1. What a hint does depends on the game:
  - Queens: place one correct queen, or mark a cell that cannot hold one.
  - Tango: fill one cell with its right symbol.
  - Sudoku: reveal one cell (the easiest next logical step, with a short "why").
  - Zip: show the next few steps of the path.
  - Word Guess: reveal one letter of the answer.
- Show the "why" where possible. A hint that teaches is worth more than one that just fills a cell.

### Free ways to earn
1. **Daily wheel** (your idea): one spin a day, from the Practice tab. Prizes: 1 hint (most), 2 hints, 3 hints (rare), a streak freeze (rare), nothing is never a result. A visible countdown to the next spin gives a daily reason to open the app.
2. **Level milestones**: a hint for every 10th level cleared (zone boss), and one for three stars on a "very hard" level.
3. **Streaks**: a hint on 7-day and 30-day daily streaks.
4. **First win of the day** in any game: a small bonus (a tenth of a hint is hard to explain, so make it a 1-in-3 chance of 1 hint).

### Ways to get more (later)
- **Rewarded ad**: "Watch a short video for 1 hint", offered only when the player is out of hints and taps the hint button. Cap at about 5 a day. Never show ads in the middle of a puzzle or on the dailies. Use AdMob rewarded ads on Android only; keep the web ad-free.
- **Hint packs** (in-app purchase): for example 10 hints, 30 hints, 100 hints. Pick one-time consumables, no subscriptions at first.
- **"Zenigma Plus" later** (if there is demand): unlimited practice hints, extra colour themes, extra circles, no ads. Subscription only once there is enough content to justify it.

### Guardrails
- The server owns the balance (like the freeze count) so it cannot be edited on the device. Offline, the app spends from the local copy and the server reconciles on sync, never going below zero.
- A level solved with hints still unlocks the next level but earns at most 2 stars. That keeps the map honest without punishing people who need help.
- Practice leaderboards count levels solved, not stars, so hints never matter for rank.

### Build order
1. Hint balance + hint button in Queens/Tango/Sudoku/Zip, free sources only (wheel, milestones).
2. Server balance and sync.
3. Rewarded ads and purchases only after there are real active players (and Google Play needs a privacy policy, which the app now has).

## UX ideas

### Both
- **Tutorials**: a 20-second interactive first level for each game (the help sheet is easy to skip).
- **Undo and redo** everywhere, plus a **check** button that only says whether the board has a mistake.
- **Pause** that blurs the board, so timers are not a pressure to leave the app.
- **Result screen**: after a daily, show rank, a percentile ("faster than 70%"), streak flame and one tap to share an image card.
- **Friends**: circles already exist; add a "who played today" strip on Home for circle members.
- **Seasonal themes and badges** earned by streaks (30-day streak, 100 levels, first 3-star zone).
- **Weekly recap**: "You solved 14 puzzles, best streak 9" on Home each Monday.

### Android
- **Home-screen widget**: today's streak and which dailies are done.
- **Adaptive icon + splash** that matches the theme; **predictive back** gesture.
- **Haptic themes**: separate strength for taps and for errors.
- **Resume where you left**: open straight into the unfinished board.
- **Offline-first sync indicator** that is quiet unless something needs attention.
- **Play Store**: needs an AAB, a privacy policy URL (the app has one in Settings), the account deletion path (done) and a data-safety form.

### Web
- **Installable PWA prompt** with a clear "works offline" message.
- **Keyboard play**: arrow keys and number keys on Sudoku/Tango/Queens, `Z` for undo.
- **Wide-screen layout**: board in the centre, rules and leaderboard beside it.
- **Shareable result image** (OG card) so a link shows the grid in chat apps.
