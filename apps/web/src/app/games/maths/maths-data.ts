/**
 * Maths practice: mental-maths tricks, each with a short lesson and a question maker for three levels.
 * Every question carries its own worked solution, so a wrong answer shows exactly how the trick gets there.
 * All lessons are Zenigma's own wording of standard arithmetic shortcuts.
 */
export type Level = 1 | 2 | 3;
export type Rand = () => number;

export interface MathsQuestion {
  text: string;
  answer: number;
  /** The worked solution, one line per step. The last line states the answer. */
  steps: string[];
  /** Pick-one questions (yes or no): the numbers on the buttons and what they say. */
  options?: number[];
  labels?: string[];
}

export interface Trick {
  id: string;
  topic: string;
  name: string;
  /** One line: when the trick helps. */
  when: string;
  /** The trick in a few plain steps. */
  rule: string[];
  /** Why it works. */
  why: string;
  make(level: Level, rnd: Rand): MathsQuestion;
}

export interface Topic {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
}

export const TOPICS: Topic[] = [
  { id: 'add-sub', name: 'Add and subtract', emoji: '➕', blurb: 'Round, adjust and count up instead of carrying.' },
  { id: 'multiply', name: 'Faster multiplication', emoji: '✖️', blurb: 'Fives, nines, elevens and friends.' },
  { id: 'divide', name: 'Division shortcuts', emoji: '➗', blurb: 'Divide by doubling, halving and quick checks.' },
  { id: 'tables', name: 'Times tables', emoji: '🔢', blurb: 'Facts you can rebuild when memory slips.' },
  { id: 'percent', name: 'Percentages', emoji: '％', blurb: 'Discounts, tips and quick shares.' },
  { id: 'squares', name: 'Squares', emoji: '²', blurb: 'Square big numbers in your head.' },
];

const ri = (r: Rand, a: number, b: number): number => a + Math.floor(r() * (b - a + 1));
const pick = <T>(r: Rand, list: readonly T[]): T => list[Math.floor(r() * list.length)];
const mult = (r: Rand, step: number, from: number, to: number): number => step * ri(r, Math.ceil(from / step), Math.floor(to / step));
const digits = (n: number): number[] => String(n).split('').map(Number);

const addNear: Trick = {
  id: 'add-near',
  topic: 'add-sub',
  name: 'Add or take away 9s',
  when: 'Numbers just short of a round number, like 9, 99 or 98.',
  rule: ['Swap the number for the round one just above it.', 'Add or take away the round number.', 'Undo the little extra you used.'],
  why: '99 is 100 minus 1, so adding 99 is adding 100 and then stepping back one.',
  make(level, r) {
    const choices: [number, number][] = level === 1 ? [[9, 10]] : level === 2 ? [[99, 100], [98, 100]] : [[97, 100], [198, 200], [999, 1000], [996, 1000]];
    const [k, base] = pick(r, choices);
    const d = base - k;
    const n = ri(r, base + 30, base * 9 + 99);
    if (r() < 0.5) {
      const answer = n + k;
      return { text: `${n} + ${k}`, answer, steps: [`${k} is ${d} short of ${base}.`, `${n} + ${base} = ${n + base}.`, `Take back the ${d}: ${n + base} − ${d} = ${answer}.`] };
    }
    const answer = n - k;
    return { text: `${n} − ${k}`, answer, steps: [`${k} is ${d} short of ${base}.`, `${n} − ${base} = ${n - base}.`, `Give back the ${d}: ${n - base} + ${d} = ${answer}.`] };
  },
};

const fromRound: Trick = {
  id: 'from-round',
  topic: 'add-sub',
  name: 'Take from 100, 1000…',
  when: 'Taking a number away from 100, 1000 or 10000.',
  rule: ['Take every digit from 9, except the last.', 'Take the last digit from 10.', 'Read the new digits as the answer.'],
  why: 'Taking from 9s never needs a borrow, and the last digit from 10 makes up the one that was left out.',
  make(level, r) {
    const total = level === 1 ? 100 : level === 2 ? 1000 : pick(r, [1000, 10000]);
    const len = String(total).length - 1;
    let x = ri(r, 10 ** (len - 1), 10 ** len - 1);
    if (x % 10 === 0) x += ri(r, 1, 9);
    const ds = digits(x);
    const out = ds.map((d, i) => (i === ds.length - 1 ? 10 - d : 9 - d));
    const answer = total - x;
    const parts = ds.map((d, i) => (i === ds.length - 1 ? `10 − ${d} = ${10 - d}` : `9 − ${d} = ${9 - d}`));
    return { text: `${total} − ${x}`, answer, steps: ['Every digit from 9, the last one from 10:', `${parts.join(', ')}.`, `Read it as ${out.join('')}: the answer is ${answer}.`] };
  },
};

const leftRight: Trick = {
  id: 'left-right',
  topic: 'add-sub',
  name: 'Add from the left',
  when: 'Adding two bigger numbers without writing anything down.',
  rule: ['Split the second number into hundreds, tens and ones.', 'Add the biggest part first.', 'Add the next part to the running total, and so on.'],
  why: 'You say the big part of the answer first, and each small step is an easy sum.',
  make(level, r) {
    const [lo1, hi1, lo2, hi2] = level === 1 ? [21, 79, 21, 79] : level === 2 ? [101, 899, 21, 79] : [101, 899, 101, 899];
    const a = ri(r, lo1, hi1);
    let b = ri(r, lo2, hi2);
    while (b % 10 === 0 || digits(b).filter((d) => d > 0).length < 2) b = ri(r, lo2, hi2);
    const parts: number[] = [];
    String(b).split('').forEach((d, i, all) => {
      const v = Number(d) * 10 ** (all.length - 1 - i);
      if (v) parts.push(v);
    });
    let run = a;
    const steps: string[] = [`Split ${b} into ${parts.join(' + ')}.`];
    for (const p of parts) {
      steps.push(`${run} + ${p} = ${run + p}.`);
      run += p;
    }
    return { text: `${a} + ${b}`, answer: a + b, steps };
  },
};

const subNear: Trick = {
  id: 'subtract-near',
  topic: 'add-sub',
  name: 'Subtract by rounding',
  when: 'Taking away a number that ends in 7, 8 or 9.',
  rule: ['Round the number you take away up to a round number.', 'Take that away instead.', 'Add back what you rounded by.'],
  why: 'You took away a little too much, so the difference comes back to you.',
  make(level, r) {
    const d = level === 1 ? ri(r, 1, 2) : ri(r, 1, 3);
    const b = level === 3 ? ri(r, 11, 89) * 10 + 10 - d : ri(r, 1, level === 1 ? 8 : 9) * 10 + 10 - d;
    const rounded = b + d;
    const a = ri(r, rounded + 12, rounded + (level === 1 ? 70 : 600));
    const answer = a - b;
    return { text: `${a} − ${b}`, answer, steps: [`${b} is ${d} below ${rounded}.`, `${a} − ${rounded} = ${a - rounded}.`, `Add back the ${d}: ${a - rounded} + ${d} = ${answer}.`] };
  },
};

const timesFive: Trick = {
  id: 'times-5',
  topic: 'multiply',
  name: 'Multiply by 5',
  when: 'Any number times 5.',
  rule: ['Halve the number.', 'Multiply by 10: put a zero on the end.'],
  why: '5 is half of 10, so times 5 is times 10, then halved.',
  make(level, r) {
    const n = level === 1 ? mult(r, 2, 12, 98) : level === 2 ? ri(r, 101, 499) : ri(r, 1001, 4999);
    const half = n / 2;
    const answer = n * 5;
    return { text: `${n} × 5`, answer, steps: [`Half of ${n} is ${half}.`, `${half} × 10 = ${answer}.`] };
  },
};

const timesNine: Trick = {
  id: 'times-9',
  topic: 'multiply',
  name: 'Multiply by 9 or 99',
  when: 'Times 9, 99 or 999.',
  rule: ['Multiply by 10, 100 or 1000.', 'Take away the number once.'],
  why: '9 is 10 minus 1, so times 9 is ten of them take away one.',
  make(level, r) {
    const [k, base, n] = level === 1 ? [9, 10, ri(r, 12, 60)] : level === 2 ? [99, 100, ri(r, 11, 99)] : pick(r, [[99, 100, ri(r, 101, 500)], [999, 1000, ri(r, 11, 99)], [9, 10, ri(r, 101, 999)]] as [number, number, number][]);
    const answer = n * k;
    return { text: `${n} × ${k}`, answer, steps: [`${n} × ${base} = ${n * base}.`, `Take away one ${n}: ${n * base} − ${n} = ${answer}.`] };
  },
};

const timesEleven: Trick = {
  id: 'times-11',
  topic: 'multiply',
  name: 'Multiply by 11',
  when: 'Two-digit numbers times 11 (and bigger ones too).',
  rule: ['Keep the two end digits.', 'Add them and put the sum in the middle.', 'If the sum is 10 or more, carry the 1 to the left.'],
  why: 'Times 11 is times 10 plus the number, so each digit is added to its neighbour.',
  make(level, r) {
    if (level === 3) {
      const n = ri(r, 101, 999);
      return { text: `${n} × 11`, answer: n * 11, steps: [`${n} × 10 = ${n * 10}.`, `Add one more ${n}: ${n * 10} + ${n} = ${n * 11}.`] };
    }
    let a: number, b: number;
    do {
      a = ri(r, 1, 9);
      b = ri(r, 1, 9);
    } while (level === 1 ? a + b > 9 : a + b < 10);
    const n = a * 10 + b;
    const s = a + b;
    const steps = [`Keep the ends: ${a} _ ${b}.`, `Add the digits: ${a} + ${b} = ${s}.`];
    steps.push(s < 10 ? `Put it in the middle: ${a}${s}${b}.` : `Put ${s - 10} in the middle and carry 1 to the front: ${a + 1}${s - 10}${b}.`);
    return { text: `${n} × 11`, answer: n * 11, steps };
  },
};

const timesTwentyFive: Trick = {
  id: 'times-25',
  topic: 'multiply',
  name: 'Multiply by 25',
  when: 'Anything times 25.',
  rule: ['Divide the number by 4.', 'Multiply that by 100.', 'Add 25 for each one left over.'],
  why: '25 is a quarter of 100.',
  make(level, r) {
    const n = level === 1 ? mult(r, 4, 8, 96) : level === 2 ? ri(r, 12, 199) : ri(r, 100, 999);
    const q = Math.floor(n / 4);
    const rem = n % 4;
    const steps = [`${n} ÷ 4 = ${q}${rem ? ` with ${rem} left over` : ''}.`, `${q} × 100 = ${q * 100}.`];
    if (rem) steps.push(`${rem} × 25 = ${rem * 25}, so ${q * 100} + ${rem * 25} = ${n * 25}.`);
    else steps.push(`So ${n} × 25 = ${n * 25}.`);
    return { text: `${n} × 25`, answer: n * 25, steps };
  },
};

const doubleHalve: Trick = {
  id: 'double-half',
  topic: 'multiply',
  name: 'Double and halve',
  when: 'One number is even and the other makes the sum awkward.',
  rule: ['Halve the even number.', 'Double the other one.', 'The answer stays the same, and the sum is easier.'],
  why: '(a ÷ 2) × (b × 2) is just a × b with the twos cancelled.',
  make(level, r) {
    if (level === 3) {
      const a = mult(r, 4, 16, 64);
      const b = ri(r, 15, 45);
      return { text: `${a} × ${b}`, answer: a * b, steps: [`Halve ${a} twice: ${a / 4}. Double ${b} twice: ${b * 4}.`, `${a / 4} × ${b * 4} = ${a * b}.`] };
    }
    const a = level === 1 ? mult(r, 2, 6, 24) : mult(r, 2, 12, 48);
    const b = level === 1 ? ri(r, 5, 15) : ri(r, 12, 35);
    return { text: `${a} × ${b}`, answer: a * b, steps: [`Halve ${a}: ${a / 2}. Double ${b}: ${b * 2}.`, `${a / 2} × ${b * 2} = ${a * b}.`] };
  },
};

const roundAdjust: Trick = {
  id: 'round-adjust',
  topic: 'multiply',
  name: 'Round, multiply, adjust',
  when: 'One number sits just next to a round number.',
  rule: ['Move the awkward number to the round one beside it.', 'Multiply by the round number.', 'Correct for the small difference.'],
  why: 'a × 68 is a × 70 take away a × 2: the distributive law.',
  make(level, r) {
    const d = level === 1 ? ri(r, 3, 6) : ri(r, 4, 9);
    const e = level === 1 ? 1 : ri(r, 1, level === 2 ? 2 : 3);
    const round = level === 3 ? ri(r, 10, 90) * 10 : ri(r, 2, 9) * 10;
    const below = r() < 0.5;
    const m = below ? round - e : round + e;
    const answer = d * m;
    return {
      text: `${d} × ${m}`,
      answer,
      steps: [`${m} is ${e} ${below ? 'less' : 'more'} than ${round}.`, `${d} × ${round} = ${d * round}, and ${d} × ${e} = ${d * e}.`, `${d * round} ${below ? '−' : '+'} ${d * e} = ${answer}.`],
    };
  },
};

const divideFive: Trick = {
  id: 'divide-5',
  topic: 'divide',
  name: 'Divide by 5',
  when: 'Numbers that end in 0 or 5, divided by 5.',
  rule: ['Double the number.', 'Divide by 10: drop a zero.'],
  why: 'Dividing by 5 is the same as dividing by 10 and doubling.',
  make(level, r) {
    const k = level === 1 ? ri(r, 3, 20) : level === 2 ? ri(r, 21, 120) : ri(r, 121, 800);
    const n = k * 5;
    return { text: `${n} ÷ 5`, answer: k, steps: [`Double ${n}: ${n * 2}.`, `${n * 2} ÷ 10 = ${k}.`] };
  },
};

const divideTwentyFive: Trick = {
  id: 'divide-25',
  topic: 'divide',
  name: 'Divide by 25',
  when: 'Multiples of 25.',
  rule: ['Multiply by 4.', 'Divide by 100: drop two zeros.'],
  why: '25 goes into 100 four times.',
  make(level, r) {
    const k = level === 1 ? ri(r, 2, 12) : level === 2 ? ri(r, 13, 60) : ri(r, 61, 400);
    const n = k * 25;
    return { text: `${n} ÷ 25`, answer: k, steps: [`${n} × 4 = ${n * 4}.`, `${n * 4} ÷ 100 = ${k}.`] };
  },
};

const divideHalve: Trick = {
  id: 'divide-halve',
  topic: 'divide',
  name: 'Halve to divide',
  when: 'Dividing by 4 or by 8.',
  rule: ['Halve the number.', 'Halve again for 4. Halve a third time for 8.'],
  why: '4 is 2 × 2 and 8 is 2 × 2 × 2.',
  make(level, r) {
    if (level === 3) {
      const k = ri(r, 8, 120);
      const n = k * 8;
      return { text: `${n} ÷ 8`, answer: k, steps: [`Half of ${n} is ${n / 2}.`, `Half of ${n / 2} is ${n / 4}.`, `Half of ${n / 4} is ${k}.`] };
    }
    const k = level === 1 ? ri(r, 3, 25) : ri(r, 26, 200);
    const n = k * 4;
    return { text: `${n} ÷ 4`, answer: k, steps: [`Half of ${n} is ${n / 2}.`, `Half of ${n / 2} is ${k}.`] };
  },
};

const ruleSteps = (n: number, d: number): { yes: boolean; steps: string[] } => {
  const ds = digits(n);
  const sum = ds.reduce((a, b) => a + b, 0);
  const last = n % 10;
  const last2 = n % 100;
  switch (d) {
    case 2: return { yes: last % 2 === 0, steps: [`The last digit is ${last}, which is ${last % 2 === 0 ? 'even' : 'odd'}.`] };
    case 5: return { yes: last === 0 || last === 5, steps: [`The last digit is ${last}: it must be 0 or 5.`] };
    case 10: return { yes: last === 0, steps: [`The last digit is ${last}: it must be 0.`] };
    case 3: return { yes: sum % 3 === 0, steps: [`Add the digits: ${ds.join(' + ')} = ${sum}.`, `${sum} is ${sum % 3 === 0 ? '' : 'not '}in the 3 times table.`] };
    case 9: return { yes: sum % 9 === 0, steps: [`Add the digits: ${ds.join(' + ')} = ${sum}.`, `${sum} is ${sum % 9 === 0 ? '' : 'not '}in the 9 times table.`] };
    case 4: return { yes: last2 % 4 === 0, steps: [`Look at the last two digits: ${last2}.`, `${last2} ${last2 % 4 === 0 ? 'can' : 'cannot'} be divided by 4.`] };
    case 6: return { yes: last % 2 === 0 && sum % 3 === 0, steps: [`It must be even (last digit ${last}) and its digits must add to a multiple of 3 (${ds.join(' + ')} = ${sum}).`] };
    default: {
      const alt = ds.reverse().reduce((a, v, i) => a + (i % 2 === 0 ? v : -v), 0);
      return { yes: alt % 11 === 0, steps: [`Add and take away the digits in turn from the right (ignore a minus sign): ${Math.abs(alt)}.`, `${Math.abs(alt)} ${alt % 11 === 0 ? 'is' : 'is not'} a multiple of 11 (0 counts).`] };
    }
  }
};

const divisible: Trick = {
  id: 'divisible',
  topic: 'divide',
  name: 'Divisibility checks',
  when: 'Checking whether a number divides exactly, without dividing.',
  rule: ['2, 5, 10: look at the last digit.', '3 and 9: add the digits.', '4: look at the last two digits. 6: even and a multiple of 3.', '11: add and take away the digits in turn.'],
  why: 'Each rule is the remainder of the place values, which repeat in a pattern.',
  make(level, r) {
    const d = pick(r, level === 1 ? [2, 5, 10, 3] : level === 2 ? [3, 4, 6, 9] : [3, 4, 6, 9, 11]);
    let n = level === 1 ? ri(r, 100, 9999) : level === 2 ? ri(r, 1000, 99999) : ri(r, 10000, 999999);
    if (r() < 0.5) n -= n % d;
    if (n < 10) n += d * 5;
    const { yes, steps } = ruleSteps(n, d);
    return { text: `Is ${n} divisible by ${d}?`, answer: yes ? 1 : 0, options: [1, 0], labels: ['Yes', 'No'], steps: [...steps, yes ? `So yes, ${d} goes in exactly.` : `So no, ${d} does not go in exactly.`] };
  },
};

const tableSteps = (a: number, b: number): string[] => {
  const p = a * b;
  switch (a) {
    case 2: return [`Double ${b}: ${p}.`];
    case 3: return [`${b} × 2 = ${b * 2}, then add one more ${b}: ${p}.`];
    case 4: return [`Double ${b}: ${b * 2}. Double again: ${p}.`];
    case 5: return [`${b} × 10 = ${b * 10}. Half of it: ${p}.`];
    case 6: return [`${b} × 5 = ${b * 5}. Add one more ${b}: ${p}.`];
    case 7: return [`${b} × 5 = ${b * 5} and ${b} × 2 = ${b * 2}.`, `${b * 5} + ${b * 2} = ${p}.`];
    case 8: return [`Double ${b}: ${b * 2}. Again: ${b * 4}. Again: ${p}.`];
    case 9: return [`${b} × 10 = ${b * 10}. Take away one ${b}: ${p}.`];
    case 10: return [`Add a zero: ${p}.`];
    case 11: return [`${b} × 10 = ${b * 10}. Add one more ${b}: ${p}.`];
    default: return [`${b} × 10 = ${b * 10} and ${b} × ${a - 10} = ${b * (a - 10)}.`, `${b * 10} + ${b * (a - 10)} = ${p}.`];
  }
};

const tablePair = (level: Level, r: Rand): [number, number] => {
  const a = level === 1 ? pick(r, [2, 3, 4, 5, 10]) : level === 2 ? pick(r, [6, 7, 8, 9, 11]) : ri(r, 11, 15);
  const b = level === 3 ? ri(r, 6, 15) : ri(r, 2, 10);
  return [a, b];
};

const timesTables: Trick = {
  id: 'times-tables',
  topic: 'tables',
  name: 'Times tables',
  when: 'Any fact that does not come to you at once.',
  rule: ['Build a hard table from an easy one.', '×9 is ×10 take away one. ×6 is ×5 plus one.', '×8 is double, double, double. ×7 is ×5 plus ×2.'],
  why: 'Every fact is a neighbour of one you already know.',
  make(level, r) {
    const [a, b] = tablePair(level, r);
    const swap = r() < 0.5;
    return { text: swap ? `${b} × ${a}` : `${a} × ${b}`, answer: a * b, steps: [...tableSteps(a, b), `So ${a} × ${b} = ${a * b}.`] };
  },
};

const tableDivision: Trick = {
  id: 'table-division',
  topic: 'tables',
  name: 'Division facts',
  when: 'The other half of every times table.',
  rule: ['Ask: what times the divisor makes this number?', 'Use the times-table trick to find it.'],
  why: 'Division undoes multiplication.',
  make(level, r) {
    const [a, b] = tablePair(level, r);
    const p = a * b;
    return { text: `${p} ÷ ${a}`, answer: b, steps: [`Think: ${a} × ? = ${p}.`, ...tableSteps(a, b), `${a} × ${b} = ${p}, so ${p} ÷ ${a} = ${b}.`] };
  },
};

const pctEasy: Trick = {
  id: 'pct-easy',
  topic: 'percent',
  name: 'Easy percentages',
  when: '10%, 50%, 25%, 75%, 20% and 1%.',
  rule: ['10% is the number ÷ 10. 1% is ÷ 100.', '50% is half. 25% is half of half. 75% is three quarters.', '20% is double 10%.'],
  why: 'Each of these is a simple fraction of the whole.',
  make(level, r) {
    const ps = level === 1 ? [10, 50] : level === 2 ? [25, 75, 20, 1] : [10, 50, 25, 75, 20, 5, 1];
    const p = pick(r, ps);
    const n = p === 1 ? ri(r, 1, level === 3 ? 20 : 9) * 100 : level === 1 ? mult(r, 20, 20, 400) : level === 2 ? mult(r, 40, 40, 800) : mult(r, 40, 100, 2000);
    const answer = (n * p) / 100;
    const how: Record<number, string[]> = {
      10: [`10% is a tenth: ${n} ÷ 10 = ${answer}.`],
      50: [`50% is half: ${n} ÷ 2 = ${answer}.`],
      25: [`25% is half of half: ${n / 2}, then ${n / 4}.`],
      75: [`25% is ${n / 4}.`, `75% is three of those: ${n / 4} × 3 = ${answer}.`],
      20: [`10% is ${n / 10}.`, `20% is double: ${answer}.`],
      5: [`10% is ${n / 10}.`, `5% is half of that: ${answer}.`],
      1: [`1% is a hundredth: ${n} ÷ 100 = ${answer}.`],
    };
    return { text: `${p}% of ${n}`, answer, steps: how[p] };
  },
};

const pctBuild: Trick = {
  id: 'pct-build',
  topic: 'percent',
  name: 'Build with 10% and 1%',
  when: 'Percentages like 15%, 30%, 35% or 12%.',
  rule: ['Find 10% (÷ 10) and, if needed, 5% (half of it) or 1% (÷ 100).', 'Add the pieces together.'],
  why: 'Any percentage is a few tens, a five and some ones.',
  make(level, r) {
    if (level === 1) {
      const p = pick(r, [20, 30, 40, 60, 70, 80, 90]);
      const n = mult(r, 10, 30, 300);
      const ten = n / 10;
      return { text: `${p}% of ${n}`, answer: ten * (p / 10), steps: [`10% of ${n} is ${ten}.`, `${p}% is ${p / 10} tens: ${p / 10} × ${ten} = ${ten * (p / 10)}.`] };
    }
    if (level === 2) {
      const p = pick(r, [15, 35, 45, 55, 65]);
      const n = mult(r, 20, 40, 400);
      const ten = n / 10;
      const five = n / 20;
      const tens = Math.floor(p / 10);
      return { text: `${p}% of ${n}`, answer: (n * p) / 100, steps: [`10% of ${n} is ${ten}, and 5% is ${five}.`, `${p}% is ${tens} × ${ten} + ${five} = ${tens * ten} + ${five} = ${(n * p) / 100}.`] };
    }
    const t = ri(r, 1, 2);
    const k = ri(r, 1, 9);
    const p = t * 10 + k;
    const n = mult(r, 100, 100, 900);
    const ten = n / 10;
    const one = n / 100;
    return { text: `${p}% of ${n}`, answer: (n * p) / 100, steps: [`10% of ${n} is ${ten}, and 1% is ${one}.`, `${p}% is ${t} × ${ten} + ${k} × ${one} = ${t * ten} + ${k * one} = ${(n * p) / 100}.`] };
  },
};

const pctSwap: Trick = {
  id: 'pct-swap',
  topic: 'percent',
  name: 'Flip the percentage',
  when: 'A small percentage of a number like 50, 25 or 20.',
  rule: ['x% of y is the same as y% of x.', 'Flip them when the new one is easier.'],
  why: 'Both mean x × y ÷ 100.',
  make(level, r) {
    const y = level === 1 ? 50 : level === 2 ? pick(r, [50, 25]) : pick(r, [50, 25, 20]);
    const step = y === 50 ? 2 : y === 25 ? 4 : 5;
    const x = mult(r, step, level === 1 ? 6 : 12, level === 1 ? 40 : level === 2 ? 96 : 200);
    const answer = (x * y) / 100;
    const how = y === 50 ? `half of ${x}` : y === 25 ? `a quarter of ${x}` : `a fifth of ${x}`;
    return { text: `${x}% of ${y}`, answer, steps: [`${x}% of ${y} is the same as ${y}% of ${x}.`, `${y}% of ${x} is ${how}.`, `That is ${answer}.`] };
  },
};

const pctDiscount: Trick = {
  id: 'pct-discount',
  topic: 'percent',
  name: 'Sale prices',
  when: 'Working out a price after a discount or a tax on top.',
  rule: ['Find the percentage of the price.', 'Take it away for a discount. Add it for a charge on top.'],
  why: 'The new price is the old one minus (or plus) its percentage.',
  make(level, r) {
    const d = pick(r, level === 1 ? [10, 50] : level === 2 ? [10, 20, 25, 50] : [5, 15, 30, 35, 40, 45]);
    const price = level === 1 ? mult(r, 20, 40, 400) : mult(r, 20, 60, 1200);
    const amount = (price * d) / 100;
    if (level > 1 && r() < 0.3) {
      return { text: `${price} plus ${d}% on top`, answer: price + amount, steps: [`${d}% of ${price} is ${amount}.`, `${price} + ${amount} = ${price + amount}.`] };
    }
    return { text: `${price} with ${d}% off`, answer: price - amount, steps: [`${d}% of ${price} is ${amount}.`, `${price} − ${amount} = ${price - amount}.`] };
  },
};

const squareFive: Trick = {
  id: 'square-5',
  topic: 'squares',
  name: 'Squares ending in 5',
  when: 'Squaring 15, 25, 35… 95, 105…',
  rule: ['Drop the 5 to get the tens number, a.', 'Multiply a by (a + 1).', 'Write 25 after it.'],
  why: '(10a + 5)² = 100a(a + 1) + 25.',
  make(level, r) {
    const a = level === 1 ? ri(r, 1, 5) : level === 2 ? ri(r, 6, 9) : ri(r, 10, 15);
    const n = a * 10 + 5;
    const answer = n * n;
    return { text: `${n}²`, answer, steps: [`Drop the 5: ${a}.`, `${a} × ${a + 1} = ${a * (a + 1)}.`, `Put 25 on the end: ${answer}.`] };
  },
};

const squareSplit: Trick = {
  id: 'square-split',
  topic: 'squares',
  name: 'Squares by splitting',
  when: 'Squaring numbers in the teens, twenties and thirties.',
  rule: ['Split the number into tens and ones: (a + b).', 'Square the tens, double the tens times the ones, square the ones.', 'Add the three parts.'],
  why: '(a + b)² = a² + 2ab + b².',
  make(level, r) {
    const k = level === 1 ? 1 : level === 2 ? 2 : ri(r, 3, 4);
    const b = ri(r, 1, 9);
    const n = k * 10 + b;
    const a = k * 10;
    const answer = n * n;
    return { text: `${n}²`, answer, steps: [`${n} = ${a} + ${b}.`, `${a}² = ${a * a}. 2 × ${a} × ${b} = ${2 * a * b}. ${b}² = ${b * b}.`, `${a * a} + ${2 * a * b} + ${b * b} = ${answer}.`] };
  },
};

const squareNear: Trick = {
  id: 'square-near',
  topic: 'squares',
  name: 'Squares near a ten',
  when: 'Numbers a step or two from a multiple of 10.',
  rule: ['Find the nearest ten and how far you are from it, d.', 'Move one down by d and the other up by d, and multiply.', 'Add d².'],
  why: 'n² = (n − d)(n + d) + d², and one of the two factors is a round number.',
  make(level, r) {
    const [lo, hi] = level === 1 ? [12, 38] : level === 2 ? [41, 79] : [71, 99];
    let n = ri(r, lo, hi);
    while (n % 5 === 0) n = ri(r, lo, hi);
    const t = Math.round(n / 10) * 10;
    const d = Math.abs(n - t);
    const lowF = n - d;
    const highF = n + d;
    const answer = n * n;
    return { text: `${n}²`, answer, steps: [`${n} is ${d} ${n > t ? 'above' : 'below'} ${t}.`, `${lowF} × ${highF} = ${lowF * highF}.`, `Add ${d}² = ${d * d}: ${lowF * highF} + ${d * d} = ${answer}.`] };
  },
};

export const TRICKS: Trick[] = [addNear, fromRound, leftRight, subNear, timesFive, timesNine, timesEleven, timesTwentyFive, doubleHalve, roundAdjust, divideFive, divideTwentyFive, divideHalve, divisible, timesTables, tableDivision, pctEasy, pctBuild, pctSwap, pctDiscount, squareFive, squareSplit, squareNear];

export const trickById = (id: string): Trick | undefined => TRICKS.find((t) => t.id === id);
export const tricksOf = (topic: string): Trick[] => TRICKS.filter((t) => t.topic === topic);
export const topicById = (id: string): Topic | undefined => TOPICS.find((t) => t.id === id);
export const LEVELS: { id: Level; name: string }[] = [
  { id: 1, name: 'Starter' },
  { id: 2, name: 'Sharper' },
  { id: 3, name: 'Expert' },
];
