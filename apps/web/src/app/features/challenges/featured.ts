/**
 * The featured level of the week: one hard level, the same for everyone, that changes every Monday. It is played like any practice level
 * (hints and all) and counts once solved. It rotates through the games so each gets its turn.
 */
export interface Featured {
  game: 'queens' | 'tango' | 'sudoku' | 'zip' | 'patches';
  /** The Sudoku kind or tier id, when the game has them. */
  variant?: string;
  /** The practice track the level is stored under. */
  track: string;
  level: number;
  name: string;
  /** The Monday it started (local date, yyyy-mm-dd). */
  week: string;
}

const ROTATION: { game: Featured['game']; variant?: string; name: string; from: number }[] = [
  { game: 'sudoku', variant: 'classic-insane', name: 'Sudoku · Classic · Insane', from: 600 },
  { game: 'queens', variant: 'classic-insane', name: 'Crowns · Insane', from: 600 },
  { game: 'sudoku', variant: 'diagonal', name: 'Sudoku · Diagonal', from: 1200 },
  { game: 'zip', variant: 'classic-insane', name: 'Zipline · Insane', from: 600 },
  { game: 'sudoku', variant: 'windoku', name: 'Sudoku · Windoku', from: 1200 },
  { game: 'tango', variant: 'classic-insane', name: 'Eclipse · Insane', from: 600 },
  { game: 'sudoku', variant: 'knight', name: 'Sudoku · Anti-Knight', from: 1200 },
  { game: 'patches', variant: 'classic-insane', name: 'Patchwork · Insane', from: 600 },
  { game: 'sudoku', variant: 'mini-insane', name: 'Sudoku · Mini · Insane', from: 600 },
  { game: 'sudoku', variant: 'disjoint', name: 'Sudoku · Disjoint Groups', from: 1200 },
];

const iso = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** The featured level for the week a date falls in (weeks start on Monday). */
export function featuredFor(now: Date): Featured {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  // Whole weeks since a fixed Monday (2024-01-01), counted on the calendar so daylight saving cannot shift it.
  const weeks = Math.round((Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate()) - Date.UTC(2024, 0, 1)) / (7 * 86_400_000));
  const slot = ROTATION[((weeks % ROTATION.length) + ROTATION.length) % ROTATION.length];
  // A hard level near the top of the first pack range, picked by the week so it differs each time the game comes round.
  const span = slot.from === 600 ? 390 : 780;
  const level = slot.from + ((weeks * 37) % span);
  return { game: slot.game, variant: slot.variant, track: slot.variant ? `${slot.game}-${slot.variant}` : slot.game, level, name: slot.name, week: iso(monday) };
}
