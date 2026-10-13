import { ChangeDetectionStrategy, Component, OnInit, output, signal } from '@angular/core';
import { MindResult, pick, randInt, shuffled, useClock } from './mind-util';

interface Question {
  shown: string;
  options: number[];
  answer: number;
}

/** Number patterns: find the rule and pick the next number. The rules get trickier as you go. */
@Component({
  selector: 'app-what-next',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './mind.scss',
  templateUrl: './what-next.html',
})
export class WhatNext implements OnInit {
  readonly done = output<MindResult>();
  protected readonly score = signal(0);
  protected readonly bad = signal(false);
  protected readonly clock = useClock(60000, () => this.done.emit({ score: this.score(), detail: `${this.score()} patterns in 60 seconds` }));
  protected readonly q = signal<Question>(this.make());
  protected readonly seconds = () => Math.ceil(this.clock.left() / 1000);

  ngOnInit(): void {
    this.clock.start();
  }

  protected answer(v: number): void {
    if (v === this.q().answer) {
      this.score.update((s) => s + 1);
    } else {
      this.clock.dock(3000);
      this.bad.set(true);
      setTimeout(() => this.bad.set(false), 300);
    }
    this.q.set(this.make());
  }

  private make(): Question {
    const level = Math.floor(this.score() / 3);
    const kinds: (() => number[])[] = [
      () => {
        const d = randInt(2, 9);
        const a = randInt(1, 20);
        return Array.from({ length: 6 }, (_, i) => a + d * i); // add the same number
      },
      () => {
        const r = randInt(2, 3);
        const a = randInt(1, 4);
        return Array.from({ length: 5 }, (_, i) => a * r ** i); // multiply by the same number
      },
      () => {
        const a = randInt(1, 9);
        return Array.from({ length: 6 }, (_, i) => (i + a) ** 2); // squares
      },
      () => {
        const a = randInt(1, 5);
        const b = randInt(1, 5);
        const out = [a, b];
        while (out.length < 6) out.push(out[out.length - 1] + out[out.length - 2]); // each is the sum of the last two
        return out;
      },
      () => {
        const a = randInt(5, 30);
        const x = randInt(2, 6);
        const y = randInt(1, 4);
        return Array.from({ length: 6 }, (_, i) => (i % 2 === 0 ? a + x * (i / 2) : a - y * ((i - 1) / 2) - 1)); // two interleaved steps (approximate rule shown by the numbers)
      },
      () => {
        const a = randInt(2, 6);
        const d = randInt(1, 3);
        return Array.from({ length: 6 }, (_, i) => a + (i * (i + 1) * d) / 2); // the step grows by the same amount each time
      },
    ];
    const pool = level < 1 ? kinds.slice(0, 2) : level < 3 ? kinds.slice(0, 4) : kinds;
    const seq = pick(pool)();
    const answer = seq[seq.length - 1];
    const options = new Set<number>([answer]);
    while (options.size < 4) options.add(answer + randInt(1, 8) * (Math.random() < 0.5 ? -1 : 1));
    return { shown: seq.slice(0, -1).join(', ') + ', ?', options: shuffled([...options]), answer };
  }
}
