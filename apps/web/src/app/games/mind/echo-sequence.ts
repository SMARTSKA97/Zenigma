import { ChangeDetectionStrategy, Component, OnInit, output, signal } from '@angular/core';
import { MindResult, randInt, useTimers } from './mind-util';

const PADS = ['#d93f3f', '#2f6fe0', '#2e9e5b', '#d8a800'];

/** A Simon-style memory game: watch the pattern, then repeat it. */
@Component({
  selector: 'app-echo-sequence',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './mind.scss',
  template: `
    <div class="hud"><span>Round {{ seq().length || 1 }}</span><span>Best run {{ best() }}</span></div>
    <p class="say">{{ phase() === 'show' ? 'Watch…' : phase() === 'input' ? 'Your turn' : '' }}</p>
    <div class="pads">
      @for (c of pads; track $index) {
        <button type="button" class="pad" [class.lit]="lit() === $index" [style.background]="c" [disabled]="phase() !== 'input'" (click)="press($index)" [attr.aria-label]="'Pad ' + ($index + 1)"></button>
      }
    </div>
  `,
})
export class EchoSequence implements OnInit {
  readonly done = output<MindResult>();
  private readonly timers = useTimers();
  protected readonly pads = PADS;
  protected readonly seq = signal<number[]>([]);
  protected readonly phase = signal<'show' | 'input' | 'over'>('show');
  protected readonly lit = signal(-1);
  protected readonly best = signal(0);
  private at = 0;

  ngOnInit(): void {
    this.next();
  }

  private next(): void {
    this.seq.update((s) => [...s, randInt(0, 3)]);
    this.phase.set('show');
    this.at = 0;
    let t = 700;
    for (const pad of this.seq()) {
      this.timers.after(t, () => this.lit.set(pad));
      this.timers.after(t + 450, () => this.lit.set(-1));
      t += 750;
    }
    this.timers.after(t, () => this.phase.set('input'));
  }

  protected press(i: number): void {
    if (this.phase() !== 'input') return;
    this.lit.set(i);
    this.timers.after(150, () => this.lit.set(-1));
    if (i !== this.seq()[this.at]) {
      this.phase.set('over');
      const score = this.seq().length - 1;
      this.timers.after(500, () => this.done.emit({ score, detail: `You repeated ${score} ${score === 1 ? 'step' : 'steps'}` }));
      return;
    }
    this.at++;
    if (this.at === this.seq().length) {
      this.best.set(this.seq().length);
      this.phase.set('show');
      this.timers.after(700, () => this.next());
    }
  }
}
