import { ChangeDetectionStrategy, Component, OnInit, output, signal } from '@angular/core';
import { MindResult, pick, useTimers } from './mind-util';

const LETTERS = ['B', 'D', 'F', 'K', 'M', 'R', 'T'];
const TOTAL = 26;

/** A 2-back task: tap Match when the letter is the same as the one two steps before. */
@Component({
  selector: 'app-back-track',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './mind.scss',
  template: `
    <div class="hud"><span>{{ score() }} points</span><span>{{ index() }} / {{ total }}</span></div>
    <div class="prompt" aria-live="polite">{{ letter() }}</div>
    <p class="say">Same as two letters ago?</p>
    <button type="button" class="opt wide" [class.flash-bad]="miss()" (pointerdown)="match()">Match</button>
  `,
  styles: `
    :host .wide {
      width: min(100%, 18rem);
      min-height: 4.2rem;
    }
  `,
})
export class BackTrack implements OnInit {
  readonly done = output<MindResult>();
  private readonly timers = useTimers();
  protected readonly total = TOTAL;
  protected readonly score = signal(0);
  protected readonly index = signal(0);
  protected readonly letter = signal('');
  protected readonly miss = signal(false);
  private readonly seq: string[] = [];
  private pressed = false;

  ngOnInit(): void {
    this.timers.after(700, () => this.next());
  }

  private next(): void {
    // The previous letter is over: a match that was not tapped costs a point.
    const i = this.seq.length;
    if (i > 0) this.settle(i - 1);
    if (i >= TOTAL) {
      this.letter.set('');
      this.done.emit({ score: this.score(), detail: `${this.score()} points from ${TOTAL} letters` });
      return;
    }
    // About a third of the letters repeat the one two back.
    const target = i >= 2 && Math.random() < 0.33;
    const next = target ? this.seq[i - 2] : pick(LETTERS.filter((l) => l !== this.seq[i - 2]));
    this.seq.push(next);
    this.pressed = false;
    this.index.set(i + 1);
    this.letter.set(next);
    this.timers.after(1900, () => this.next());
  }

  private settle(i: number): void {
    const isMatch = i >= 2 && this.seq[i] === this.seq[i - 2];
    if (isMatch && !this.pressed) this.score.update((s) => Math.max(0, s - 1));
  }

  protected match(): void {
    const i = this.seq.length - 1;
    if (i < 0 || this.pressed) return;
    this.pressed = true;
    const isMatch = i >= 2 && this.seq[i] === this.seq[i - 2];
    if (isMatch) {
      this.score.update((s) => s + 1);
    } else {
      this.score.update((s) => Math.max(0, s - 1));
      this.miss.set(true);
      this.timers.after(300, () => this.miss.set(false));
    }
  }
}
