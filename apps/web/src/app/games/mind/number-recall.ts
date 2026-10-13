import { ChangeDetectionStrategy, Component, OnInit, output, signal } from '@angular/core';
import { MindResult, randInt, useTimers } from './mind-util';

/** A number flashes up. Type it back. One digit longer each round. */
@Component({
  selector: 'app-number-recall',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './mind.scss',
  template: `
    <div class="hud"><span>{{ length() }} digits</span><span class="lives" aria-label="Lives left">{{ '♥'.repeat(lives()) }}</span></div>
    <div class="prompt">{{ phase() === 'show' ? number() : typed() || '…' }}</div>
    <p class="say">{{ phase() === 'show' ? 'Remember it…' : phase() === 'input' ? 'Type what you saw' : feedback() }}</p>
    <div class="options keys">
      @for (k of keys; track k) {
        <button type="button" class="opt" [disabled]="phase() !== 'input'" (click)="press(k)">{{ k }}</button>
      }
      <button type="button" class="opt" [disabled]="phase() !== 'input'" (click)="back()" aria-label="Delete">⌫</button>
      <button type="button" class="opt" [disabled]="phase() !== 'input' || typed().length === 0" (click)="check()">OK</button>
    </div>
  `,
  styles: `
    .keys {
      grid-template-columns: repeat(3, 1fr);
    }
  `,
})
export class NumberRecall implements OnInit {
  readonly done = output<MindResult>();
  private readonly timers = useTimers();
  protected readonly keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
  protected readonly length = signal(3);
  protected readonly lives = signal(2);
  protected readonly number = signal('');
  protected readonly typed = signal('');
  protected readonly phase = signal<'show' | 'input' | 'over'>('show');
  protected readonly feedback = signal('');

  ngOnInit(): void {
    this.round();
  }

  private round(): void {
    const n = this.length();
    let s = String(randInt(1, 9));
    while (s.length < n) s += String(randInt(0, 9));
    this.number.set(s);
    this.typed.set('');
    this.feedback.set('');
    this.phase.set('show');
    this.timers.after(1100 + n * 380, () => this.phase.set('input'));
  }

  protected press(k: string): void {
    if (this.typed().length < this.length()) this.typed.update((t) => t + k);
    if (this.typed().length === this.length()) this.check();
  }

  protected back(): void {
    this.typed.update((t) => t.slice(0, -1));
  }

  protected check(): void {
    if (this.phase() !== 'input') return;
    if (this.typed() === this.number()) {
      this.phase.set('over');
      this.feedback.set('Correct!');
      this.timers.after(700, () => {
        this.length.update((l) => l + 1);
        this.round();
      });
      return;
    }
    this.lives.update((l) => l - 1);
    this.phase.set('over');
    this.feedback.set(`It was ${this.number()}`);
    if (this.lives() <= 0) {
      const score = this.length() - 1;
      this.timers.after(1400, () => this.done.emit({ score, detail: `Your memory span is ${score} digits` }));
    } else {
      this.timers.after(1400, () => this.round());
    }
  }
}
