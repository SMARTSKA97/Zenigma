import { ChangeDetectionStrategy, Component, OnInit, output, signal } from '@angular/core';
import { MindResult, pick, randInt, shuffled, useClock } from './mind-util';

interface Question {
  text: string;
  options: number[];
  answer: number;
}

/** Sums against the clock. The numbers grow as you get more right. */
@Component({
  selector: 'app-quick-sums',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './mind.scss',
  template: `
    <div class="hud"><span>{{ score() }} correct</span><span>{{ seconds() }}s</span></div>
    <div class="time"><i [style.width.%]="(clock.left() / 60000) * 100"></i></div>
    <div class="prompt" [class.flash-bad]="bad()">{{ q().text }}</div>
    <div class="options">
      @for (o of q().options; track $index) {
        <button type="button" class="opt" (click)="answer(o)">{{ o }}</button>
      }
    </div>
  `,
})
export class QuickSums implements OnInit {
  readonly done = output<MindResult>();
  protected readonly score = signal(0);
  protected readonly bad = signal(false);
  protected readonly clock = useClock(60000, () => this.done.emit({ score: this.score(), detail: `${this.score()} correct in 60 seconds` }));
  protected readonly q = signal<Question>(this.make());
  protected readonly seconds = () => Math.ceil(this.clock.left() / 1000);

  ngOnInit(): void {
    this.clock.start();
  }

  protected answer(value: number): void {
    if (value === this.q().answer) {
      this.score.update((s) => s + 1);
    } else {
      this.clock.dock(3000);
      this.bad.set(true);
      setTimeout(() => this.bad.set(false), 300);
    }
    this.q.set(this.make());
  }

  private make(): Question {
    const level = Math.floor(this.score() / 5);
    const top = 9 + level * 4;
    const op = pick(level < 1 ? ['+', '-'] : ['+', '-', '×']);
    let a = randInt(2, top);
    let b = randInt(2, op === '×' ? Math.min(12, 5 + level) : top);
    if (op === '-' && b > a) [a, b] = [b, a];
    const answer = op === '+' ? a + b : op === '-' ? a - b : a * b;
    const options = new Set<number>([answer]);
    while (options.size < 4) {
      const off = randInt(1, 6) * (Math.random() < 0.5 ? -1 : 1);
      if (answer + off >= 0) options.add(answer + off);
    }
    return { text: `${a} ${op} ${b}`, options: shuffled([...options]), answer };
  }
}
