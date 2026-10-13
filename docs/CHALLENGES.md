# Ways to make each game harder

This is the menu of difficulty ideas for every game. ✅ means it is in the app, ⬜ is still to do. A "kind" is its own practice track with its own levels (and server check); a "rule" is a setting that works on any level without new levels.

## Rules that work on any puzzle (no new levels needed)

- ⬜ **Strikes**: three wrong moves and the board resets (uses the same mistake check as Check).
- ⬜ **Par clock**: a countdown to beat the par time for the level, not just a stopwatch.
- ⬜ **No hints, no Check** badge-run: a toggle on the start of a level, counted for a badge.
- ⬜ **Fading clues**: givens dim after a few seconds and come back when you hold them (memory pressure).
- ⬜ **Blind mode**: no highlighting of rows, columns and matching numbers.
- ✅ Pause cannot be used to study the board: the cover hides it.

## Zip

- ✅ **Walls**: barriers between side-by-side cells that the path may not cross (kind `zip-walls`).
- ✅ **Blocked cells**: holes the path goes around, covering every open cell (kind `zip-holes`).
- ⬜ **Fewer waypoints**: already how the tiers get harder; the insane tier shows the fewest numbers.
- ⬜ **One-way gates**: an arrow edge that can only be crossed in one direction.
- ⬜ **Portals**: two cells that are neighbours for the path (a wrap-around).
- ⬜ **Free finish**: the path may end anywhere (no top number marks the end).
- ⬜ **Bridges**: a cell the path must cross twice, once in each direction.

## Queens

- ✅ Bigger boards and fewer pre-placed queens per tier (5×5 up to 9×9).
- ⬜ **Blocked cells**: crossed-out cells that cannot hold a queen.
- ⬜ **Two queens per row, column and colour** on a larger board.
- ⬜ **Giant Queens** 10×10 and up. The generator needs a faster solver first (11×11 takes minutes).
- ⬜ **Hidden borders**: colours without outlines, so regions must be read by colour alone (kind for colour-blind players: pattern fills).
- ⬜ **Touching rule widened**: no two queens within two cells.

## Tango

- ✅ Fewer given clues and fewer `=` / `×` signs per tier.
- ⬜ **Big Tango** 8×8. The generator is fixed at 6×6 today.
- ⬜ **Hidden signs**: some `=`/`×` shown only after you place a neighbour.
- ⬜ **Third symbol**: a third colour with "no three in a row" and equal counts.
- ⬜ **Pre-placed locked cells** that look like empty ones (a trap).

## Patches

- ✅ Styled like LinkedIn Patches: coloured clue tiles, shapes, solid patches.
- ✅ **Shapes only**: many numbers are hidden, so a clue shows just the shape (kind `patches-shapes`).
- ⬜ **Blocked cells** that no patch may cover.
- ⬜ **Numbers only** with no shape hints on the hardest tier.
- ⬜ **Colour-matched clues**: two clues of the same colour must end up in patches of equal size.
- ⬜ **Bigger grids** 9×9 and 10×10.

## Sudoku

- ✅ Five tiers by number of clues; Mini 6×6 and Classic 9×9.
- ✅ Extra-rule kinds: Diagonal, Windoku, Disjoint, Anti-Knight, Killer, Thermo, Jigsaw, Arrow, Sandwich, Consecutive, Even-Odd.
- ⬜ **Anti-King**, **Renban**, **Little Killer**, **Kropki dots**, **Non-consecutive**, **Anti-Knight + Windoku** combos.
- ⬜ **Notes off**: a run where pencil marks are disabled.
- ⬜ **Mistake limit** rule (see strikes above).

## Word Guess

- ✅ Hard mode (revealed hints must be used).
- ⬜ **Four, six and seven letters**; **Speed Guess** (three minutes); **Duel**; **Themed words**.
- ⬜ **Fewer tries**: five instead of six.
- ⬜ **Ghost letters**: one of the greens is hidden.

## Mind training

- ✅ Scores are scaled against "excellent", so every game ramps within a round (levels get faster, longer, or bigger).
- ⬜ **Dual tasks**: two games at once (a memory span while doing sums).
- ⬜ **Distractions**: background motion or sounds that must be ignored in attention games.
- ⬜ **Adaptive difficulty**: the next round starts at the level you reached last time.
- ⬜ **Streak bonus**: consecutive right answers raise the points per answer.

## How to add one

1. Generator: add the case to `practiceLevel` in `tools/generators/puzzles/games.mjs` (and the generator itself), the track to `TRACKS` and `level-counts.json`.
2. Server: `PuzzleRules.Tracks`, and the verifier in `PuzzleRules.cs` if the puzzle has new fields.
3. App: the engine (`canStep`/`isRight`/`verify`), the hint solver in `hints/solvers.ts`, the board drawing, and `VARIANTS` in `catalog.ts`.
4. Run `node build-levels.mjs`, `node build-levels.mjs --verify`, `node gen-vectors.mjs`, and the web tests.
