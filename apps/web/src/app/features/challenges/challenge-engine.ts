/**
 * Weekly, weekend and monthly challenges. Each period offers a few goals picked from a pool (the same for everyone, by calendar),
 * and progress is worked out on the device from what you solved in that period. Finishing one earns hints (the usual free cap applies).
 * Pure functions only, so the rules are easy to test.
 */

export type Period = 'weekly' | 'weekend' | 'monthly';

/** One thing the player solved, from the event log (practice and Word Guess) or the daily stats. */
export interface Activity {
  at: Date;
  /** 'word-guess', 'queens', 'sudoku' ... */
  game: string;
  /** A Sudoku kind or tier id ('classic-hard', 'diagonal'), when there is one. */
  variant?: string;
  kind: 'practice' | 'daily' | 'mind';
  /** True when no hint was used (unknown for results saved before hints were recorded). */
  clean?: boolean;
  /** `track:level` or the daily's date, so a repeat is not counted twice. */
  id: string;
}

type Metric = (items: Activity[]) => number;

const distinct = (items: Activity[], by: (a: Activity) => string | undefined): number => new Set(items.map(by).filter(Boolean)).size;
const dayOf = (d: Date): string => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

const METRICS = {
  /** Distinct practice levels solved. */
  levels: (items) => distinct(items.filter((a) => a.kind === 'practice'), (a) => a.id),
  /** Everything solved: practice, Word Guess and dailies. */
  solves: (items) => distinct(items, (a) => `${a.kind}:${a.id}`),
  dailies: (items) => distinct(items.filter((a) => a.kind === 'daily'), (a) => a.id),
  games: (items) => distinct(items, (a) => a.game),
  days: (items) => distinct(items, (a) => dayOf(a.at)),
  clean: (items) => distinct(items.filter((a) => a.kind === 'practice' && a.clean === true), (a) => a.id),
  hard: (items) => distinct(items.filter((a) => a.game === 'sudoku' && /-(hard|challenging|insane)$/.test(a.variant ?? '')), (a) => a.id),
  sudokuKinds: (items) => distinct(items.filter((a) => a.game === 'sudoku'), (a) => (a.variant ?? '').replace(/-(easy|medium|hard|challenging|insane)$/, '')),
  words: (items) => distinct(items.filter((a) => a.game === 'word-guess'), (a) => `${a.kind}:${a.id}`),
  sudoku: (items) => distinct(items.filter((a) => a.game === 'sudoku'), (a) => `${a.kind}:${a.id}`),
  /** Mind-training games played. */
  mind: (items) => distinct(items.filter((a) => a.kind === 'mind'), (a) => a.id),
  logic: (items) => distinct(items.filter((a) => ['queens', 'tango', 'zip', 'patches'].includes(a.game)), (a) => `${a.kind}:${a.id}`),
} satisfies Record<string, Metric>;
export type MetricName = keyof typeof METRICS;

export interface Template {
  id: string;
  period: Period;
  title: string;
  /** What to do, in a short sentence. */
  text: string;
  metric: MetricName;
  target: number;
  /** Hints earned. */
  reward: 1 | 2 | 3;
  icon: string;
}

/** The pool each period draws from. Ids never change once shipped (claimed rewards are remembered by id). */
export const POOL: Template[] = [
  // Weekly (Monday to Sunday)
  { id: 'w-levels-15', period: 'weekly', icon: '🧗', title: 'Level climber', text: 'Clear 15 practice levels this week', metric: 'levels', target: 15, reward: 1 },
  { id: 'w-levels-30', period: 'weekly', icon: '🚵', title: 'Big week', text: 'Clear 30 practice levels this week', metric: 'levels', target: 30, reward: 2 },
  { id: 'w-dailies-4', period: 'weekly', icon: '📅', title: 'Daily habit', text: 'Solve 4 dailies this week', metric: 'dailies', target: 4, reward: 1 },
  { id: 'w-dailies-10', period: 'weekly', icon: '🗓️', title: 'Daily devotion', text: 'Solve 10 dailies this week', metric: 'dailies', target: 10, reward: 2 },
  { id: 'w-games-3', period: 'weekly', icon: '🎲', title: 'Try a little of everything', text: 'Solve something in 3 different games', metric: 'games', target: 3, reward: 1 },
  { id: 'w-games-5', period: 'weekly', icon: '🌈', title: 'All-rounder', text: 'Solve something in 5 different games', metric: 'games', target: 5, reward: 2 },
  { id: 'w-days-5', period: 'weekly', icon: '🔥', title: 'Five days running', text: 'Play on 5 different days', metric: 'days', target: 5, reward: 2 },
  { id: 'w-clean-8', period: 'weekly', icon: '🧠', title: 'No help needed', text: 'Clear 8 levels without a hint', metric: 'clean', target: 8, reward: 1 },
  { id: 'w-sudoku-8', period: 'weekly', icon: '🔢', title: 'Sudoku week', text: 'Solve 8 Sudoku puzzles', metric: 'sudoku', target: 8, reward: 1 },
  { id: 'w-hard-3', period: 'weekly', icon: '💎', title: 'Hard mode', text: 'Clear 3 Sudoku levels on Hard or above', metric: 'hard', target: 3, reward: 2 },
  { id: 'w-logic-10', period: 'weekly', icon: '🧩', title: 'Logic lover', text: 'Solve 10 Queens, Tango, Zip or Patches puzzles', metric: 'logic', target: 10, reward: 1 },
  { id: 'w-words-5', period: 'weekly', icon: '🔤', title: 'Word nerd', text: 'Win 5 Word Guess games', metric: 'words', target: 5, reward: 1 },
  { id: 'w-mind-6', period: 'weekly', icon: '🧠', title: 'Brain gym', text: 'Play 6 mind-training games', metric: 'mind', target: 6, reward: 1 },
  // Weekend (Saturday and Sunday)
  { id: 'e-levels-8', period: 'weekend', icon: '🏖️', title: 'Weekend warm-up', text: 'Clear 8 practice levels this weekend', metric: 'levels', target: 8, reward: 1 },
  { id: 'e-levels-20', period: 'weekend', icon: '🎢', title: 'Weekend marathon', text: 'Clear 20 practice levels this weekend', metric: 'levels', target: 20, reward: 2 },
  { id: 'e-games-3', period: 'weekend', icon: '🎡', title: 'Weekend sampler', text: 'Solve something in 3 different games', metric: 'games', target: 3, reward: 1 },
  { id: 'e-days-2', period: 'weekend', icon: '☀️', title: 'Both days', text: 'Play on both Saturday and Sunday', metric: 'days', target: 2, reward: 1 },
  { id: 'e-dailies-2', period: 'weekend', icon: '🏁', title: 'Weekend dailies', text: 'Solve 2 dailies this weekend', metric: 'dailies', target: 2, reward: 1 },
  { id: 'e-hard-2', period: 'weekend', icon: '🧨', title: 'Weekend brain-burner', text: 'Clear 2 Sudoku levels on Hard or above', metric: 'hard', target: 2, reward: 2 },
  { id: 'e-clean-5', period: 'weekend', icon: '🧘', title: 'Calm and clean', text: 'Clear 5 levels without a hint', metric: 'clean', target: 5, reward: 1 },
  { id: 'e-mind-3', period: 'weekend', icon: '🎯', title: 'Weekend workout', text: 'Play 3 mind-training games', metric: 'mind', target: 3, reward: 1 },
  // Monthly
  { id: 'm-mind-25', period: 'monthly', icon: '🧬', title: 'Sharper every day', text: 'Play 25 mind-training games this month', metric: 'mind', target: 25, reward: 3 },
  { id: 'm-levels-100', period: 'monthly', icon: '🏔️', title: 'Hundred club', text: 'Clear 100 practice levels this month', metric: 'levels', target: 100, reward: 3 },
  { id: 'm-levels-200', period: 'monthly', icon: '🚀', title: 'Double century', text: 'Clear 200 practice levels this month', metric: 'levels', target: 200, reward: 3 },
  { id: 'm-dailies-15', period: 'monthly', icon: '📆', title: 'Daily regular', text: 'Solve 15 dailies this month', metric: 'dailies', target: 15, reward: 3 },
  { id: 'm-dailies-25', period: 'monthly', icon: '🏆', title: 'Daily champion', text: 'Solve 25 dailies this month', metric: 'dailies', target: 25, reward: 3 },
  { id: 'm-days-15', period: 'monthly', icon: '🌙', title: 'Half the month', text: 'Play on 15 different days', metric: 'days', target: 15, reward: 3 },
  { id: 'm-games-6', period: 'monthly', icon: '🎪', title: 'Whole arcade', text: 'Solve something in 6 different games', metric: 'games', target: 6, reward: 2 },
  { id: 'm-kinds-4', period: 'monthly', icon: '🧭', title: 'Sudoku explorer', text: 'Solve Sudoku in 4 different kinds', metric: 'sudokuKinds', target: 4, reward: 3 },
  { id: 'm-clean-40', period: 'monthly', icon: '✨', title: 'Pure thinker', text: 'Clear 40 levels without a hint', metric: 'clean', target: 40, reward: 3 },
  { id: 'm-hard-15', period: 'monthly', icon: '💎', title: 'Diamond hands', text: 'Clear 15 Sudoku levels on Hard or above', metric: 'hard', target: 15, reward: 3 },
];

/** How many goals each period offers. */
const COUNT: Record<Period, number> = { weekly: 3, weekend: 2, monthly: 3 };

const mondayOf = (d: Date): Date => {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
};
const iso = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export interface Window {
  period: Period;
  /** Names this period's challenge set: the date it began (weekly: Monday, weekend: Saturday, monthly: the 1st). */
  key: string;
  start: Date;
  /** Exclusive. */
  end: Date;
  /** False for a weekend that has not started yet (Monday to Friday show the coming one). */
  open: boolean;
}

/** The period a date is in. For the weekend, Monday to Friday point at the coming one (not open yet). */
export function windowOf(period: Period, now: Date): Window {
  if (period === 'monthly') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { period, key: iso(start), start, end: new Date(now.getFullYear(), now.getMonth() + 1, 1), open: true };
  }
  const monday = mondayOf(now);
  if (period === 'weekly') {
    const end = new Date(monday);
    end.setDate(end.getDate() + 7);
    return { period, key: iso(monday), start: monday, end, open: true };
  }
  const saturday = new Date(monday);
  saturday.setDate(saturday.getDate() + 5);
  const end = new Date(monday);
  end.setDate(end.getDate() + 7);
  return { period, key: iso(saturday), start: saturday, end, open: now >= saturday };
}

/** A small stable hash, so every device draws the same challenges for the same period. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** The goals offered in a window: a stable pick from the pool, never two of the same metric. */
export function picksFor(w: Window): Template[] {
  const pool = POOL.filter((t) => t.period === w.period)
    .map((t) => ({ t, order: hash(`${w.key}:${t.id}`) }))
    .sort((a, b) => a.order - b.order);
  const out: Template[] = [];
  for (const { t } of pool) {
    if (out.some((o) => o.metric === t.metric)) continue;
    out.push(t);
    if (out.length === COUNT[w.period]) break;
  }
  return out;
}

export interface ChallengeState {
  template: Template;
  window: Window;
  have: number;
  done: boolean;
  /** `period:key:id`, used to remember that the reward was collected. */
  claimKey: string;
}

/** Progress on every goal of a window, from everything the player solved in it. */
export function progressFor(w: Window, activity: Activity[]): ChallengeState[] {
  const inWindow = activity.filter((a) => a.at >= w.start && a.at < w.end);
  return picksFor(w).map((template) => {
    const have = w.open ? METRICS[template.metric](inWindow) : 0;
    return { template, window: w, have, done: have >= template.target, claimKey: `${w.period}:${w.key}:${template.id}` };
  });
}

/** Time left in a window, in words ("2d 5h", "3h 10m"). */
export function timeLeft(w: Window, now: Date): string {
  const target = w.open ? w.end : w.start;
  const minutes = Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 60000));
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  return d > 0 ? `${d}d ${h}h` : `${h}h ${minutes % 60}m`;
}

export const PERIOD_NAMES: Record<Period, string> = { weekly: 'This week', weekend: 'This weekend', monthly: 'This month' };
