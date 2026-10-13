import { describe, expect, it } from 'vitest';
import { Activity, picksFor, progressFor, timeLeft, windowOf } from './challenge-engine';

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);
const solve = (when: Date, n: number, extra: Partial<Activity> = {}): Activity => ({ at: when, game: 'queens', kind: 'practice', id: `queens::${n}`, ...extra });

describe('challenge windows', () => {
  it('starts the week on Monday and ends it the next Monday', () => {
    const w = windowOf('weekly', at(2026, 10, 14)); // a Wednesday
    expect(w.key).toBe('2026-10-12');
    expect(w.end.getDate()).toBe(19);
  });

  it('opens the weekend on Saturday and points at it on weekdays', () => {
    expect(windowOf('weekend', at(2026, 10, 14)).open).toBe(false);
    expect(windowOf('weekend', at(2026, 10, 14)).key).toBe('2026-10-17');
    expect(windowOf('weekend', at(2026, 10, 17)).open).toBe(true);
    expect(windowOf('weekend', at(2026, 10, 18)).key).toBe('2026-10-17');
  });

  it('uses the calendar month', () => {
    const w = windowOf('monthly', at(2026, 10, 31));
    expect(w.key).toBe('2026-10-01');
    expect(w.end.getMonth()).toBe(10);
  });
});

describe('challenge picks', () => {
  it('are the same for the same period and never repeat a metric', () => {
    const w = windowOf('weekly', at(2026, 10, 14));
    const a = picksFor(w);
    expect(a.map((t) => t.id)).toEqual(picksFor(w).map((t) => t.id));
    expect(a.length).toBe(3);
    expect(new Set(a.map((t) => t.metric)).size).toBe(3);
  });

  it('offer two weekend goals and three monthly goals', () => {
    expect(picksFor(windowOf('weekend', at(2026, 10, 17))).length).toBe(2);
    expect(picksFor(windowOf('monthly', at(2026, 10, 14))).length).toBe(3);
  });

  it('change from week to week', () => {
    const ids = new Set(Array.from({ length: 8 }, (_, i) => picksFor(windowOf('weekly', at(2026, 10, 5 + i * 7))).map((t) => t.id).join()));
    expect(ids.size).toBeGreaterThan(3);
  });
});

describe('challenge progress', () => {
  it('counts only what was solved inside the window, and each level once', () => {
    const w = windowOf('weekly', at(2026, 10, 14));
    const items = [solve(at(2026, 10, 12), 1), solve(at(2026, 10, 13), 1), solve(at(2026, 10, 13), 2), solve(at(2026, 10, 11), 3)];
    // Whatever goals are offered, a level solved twice counts once and one from before Monday does not count.
    const states = progressFor(w, items);
    for (const s of states) expect(['levels', 'solves', 'games', 'days', 'dailies', 'clean', 'hard', 'sudokuKinds', 'words', 'sudoku', 'logic', 'mind']).toContain(s.template.metric);
    for (const s of states.filter((x) => x.template.metric === 'games')) expect(s.have).toBe(1);
    for (const s of states.filter((x) => x.template.metric === 'days')) expect(s.have).toBe(2);
    for (const s of states.filter((x) => x.template.metric === 'levels')) expect(s.have).toBe(2);
  });

  it('shows no progress for a weekend that has not started', () => {
    const w = windowOf('weekend', at(2026, 10, 14));
    expect(progressFor(w, [solve(at(2026, 10, 17), 1)]).every((c) => c.have === 0)).toBe(true);
  });

  it('marks a goal done when the target is reached', () => {
    const w = windowOf('weekend', at(2026, 10, 17));
    const many = Array.from({ length: 25 }, (_, i) => solve(at(2026, 10, 17), i + 1, { clean: true }));
    const states = progressFor(w, many);
    for (const s of states) if (s.template.metric === 'levels' || s.template.metric === 'clean') expect(s.done).toBe(s.have >= s.template.target);
    expect(states.some((s) => s.have > 0)).toBe(true);
  });

  it('formats the time left', () => {
    const w = windowOf('weekly', at(2026, 10, 14, 12));
    expect(timeLeft(w, at(2026, 10, 14, 12))).toBe('4d 12h');
  });
});
