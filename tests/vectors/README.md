# Shared test vectors

Each game's rules are implemented twice: in TypeScript (the offline engine in the app) and in C# (the server validator
that replays the move log). Both are tested against the same JSON vectors in this folder, so the two can never drift.

Layout (added per game in its phase): `tests/vectors/<game>/*.json`, each a list of `{ puzzle, moves, expected }`.
