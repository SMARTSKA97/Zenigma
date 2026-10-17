import { ChangeDetectionStrategy, Component, OnInit, computed, inject, output, signal } from '@angular/core';
import { HapticsService } from '../../core/haptics.service';
import { MindResult, shuffled, useTimers } from './mind-util';
import { PINPOINT, PinpointCategory } from './pinpoint-data';
import { isCorrect, pointsAt } from './pinpoint-engine';

const ROUNDS = 5;

/**
 * Five words that all belong to one category are shown a clue at a time, vaguest first. Name the category. A wrong guess reveals the next clue.
 * The earlier you get it, the more it is worth (5 down to 1). Five categories a game.
 */
@Component({
  selector: 'app-pinpoint',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./mind.scss', './pinpoint.scss'],
  templateUrl: './pinpoint.html',
})
export class Pinpoint implements OnInit {
  readonly done = output<MindResult>();
  private readonly haptics = inject(HapticsService);
  private readonly timers = useTimers();

  private order: PinpointCategory[] = [];
  protected readonly round = signal(0);
  protected readonly score = signal(0);
  protected readonly shown = signal(1);
  protected readonly guess = signal('');
  protected readonly bad = signal(false);
  protected readonly outcome = signal<'playing' | 'right' | 'missed'>('playing');
  protected readonly gained = signal(0);
  protected readonly category = computed(() => this.order[this.round()]);
  protected readonly slots = [1, 2, 3, 4, 5];

  ngOnInit(): void {
    this.order = shuffled(PINPOINT).slice(0, ROUNDS);
    this.round.set(0);
  }

  protected clue(n: number): string | null {
    return n <= this.shown() || this.outcome() !== 'playing' ? this.category().clues[n - 1] : null;
  }

  protected submit(): void {
    if (this.outcome() !== 'playing') return;
    const text = this.guess().trim();
    if (!text) return;
    if (isCorrect(text, this.category())) {
      const points = pointsAt(this.shown());
      this.score.update((s) => s + points);
      this.gained.set(points);
      this.outcome.set('right');
      this.haptics.success();
      this.next();
      return;
    }
    this.miss();
  }

  /** Reveal the next clue without guessing. */
  protected more(): void {
    if (this.outcome() !== 'playing') return;
    this.miss(false);
  }

  private miss(wrong = true): void {
    if (wrong) {
      this.haptics.error();
      this.bad.set(true);
      this.timers.after(350, () => this.bad.set(false));
    }
    this.guess.set('');
    if (this.shown() >= 5) {
      this.gained.set(0);
      this.outcome.set('missed');
      this.next();
      return;
    }
    this.shown.update((n) => n + 1);
  }

  private next(): void {
    this.timers.after(1800, () => {
      if (this.round() + 1 >= ROUNDS) {
        const score = this.score();
        this.done.emit({ score, detail: `${score} of ${ROUNDS * 5} points` });
        return;
      }
      this.round.update((r) => r + 1);
      this.shown.set(1);
      this.guess.set('');
      this.outcome.set('playing');
    });
  }
}
