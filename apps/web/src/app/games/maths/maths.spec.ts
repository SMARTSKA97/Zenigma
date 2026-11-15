import { LEVELS, Level, MathsQuestion, TOPICS, TRICKS, tricksOf } from './maths-data';

/** Works the answer out again from the question text, without using the trick. */
function solve(q: MathsQuestion): number {
  let m: RegExpMatchArray | null;
  const t = q.text;
  if ((m = t.match(/^Is (\d+) divisible by (\d+)\?$/))) return Number(m[1]) % Number(m[2]) === 0 ? 1 : 0;
  if ((m = t.match(/^(\d+)² ?$/))) return Number(m[1]) ** 2;
  if ((m = t.match(/^(\d+)% of (\d+)$/))) return (Number(m[1]) * Number(m[2])) / 100;
  if ((m = t.match(/^(\d+) with (\d+)% off$/))) return Number(m[1]) - (Number(m[1]) * Number(m[2])) / 100;
  if ((m = t.match(/^(\d+) plus (\d+)% on top$/))) return Number(m[1]) + (Number(m[1]) * Number(m[2])) / 100;
  if ((m = t.match(/^(\d+) ([+−×÷]) (\d+)$/))) {
    const a = Number(m[1]);
    const b = Number(m[3]);
    return m[2] === '+' ? a + b : m[2] === '−' ? a - b : m[2] === '×' ? a * b : a / b;
  }
  throw new Error(`cannot read "${t}"`);
}

describe('Maths practice', () => {
  const levels: Level[] = [1, 2, 3];

  it('has six topics, each with tricks, and 23 tricks with unique ids', () => {
    expect(TOPICS.length).toBe(6);
    for (const t of TOPICS) expect(tricksOf(t.id).length).toBeGreaterThan(0);
    expect(TRICKS.length).toBe(23);
    expect(new Set(TRICKS.map((t) => t.id)).size).toBe(TRICKS.length);
    expect(LEVELS.length).toBe(3);
  });

  for (const trick of TRICKS) {
    it(`${trick.id}: every question at every level has the right whole-number answer and a worked solution`, () => {
      for (const level of levels) {
        for (let i = 0; i < 300; i++) {
          const q = trick.make(level, Math.random);
          expect(Number.isInteger(q.answer), q.text).toBe(true);
          expect(q.answer, q.text).toBeGreaterThanOrEqual(0);
          expect(solve(q), `${trick.id} L${level}: ${q.text}`).toBe(q.answer);
          expect(q.steps.length).toBeGreaterThan(0);
          // Yes/no questions end in words, not in the number on the button.
          if (!q.options) expect(q.steps.join(' '), `${q.text}: ${q.steps.join(' | ')}`).toContain(String(q.answer));
          expect(q.steps.join(' ')).not.toMatch(/NaN|undefined|-\d/);
        }
      }
    });
  }

  it('has a lesson on every trick', () => {
    for (const t of TRICKS) {
      expect(t.rule.length).toBeGreaterThan(0);
      expect(t.when.length).toBeGreaterThan(10);
      expect(t.why.length).toBeGreaterThan(10);
    }
  });

  it('gets harder: the numbers in level 3 are larger than in level 1 for the multiplication tricks', () => {
    const size = (id: string, level: Level) => {
      const t = TRICKS.find((x) => x.id === id)!;
      let sum = 0;
      for (let i = 0; i < 200; i++) sum += t.make(level, Math.random).answer;
      return sum / 200;
    };
    for (const id of ['times-5', 'times-9', 'times-25', 'square-5', 'divide-5']) expect(size(id, 3)).toBeGreaterThan(size(id, 1));
  });
});
