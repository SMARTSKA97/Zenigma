import { ChangeDetectionStrategy, Component, OnInit, output, signal } from '@angular/core';
import { MindResult, shuffled, useTimers } from './mind-util';

const FACES = ['🍎', '🚀', '🎲', '🌵', '🐙', '🎸', '🍋', '🔔'];

interface Card {
  face: string;
  up: boolean;
  matched: boolean;
}

/** Flip cards and find the pairs in as few flips as you can. */
@Component({
  selector: 'app-pair-match',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './mind.scss',
  templateUrl: './pair-match.html',
})
export class PairMatch implements OnInit {
  readonly done = output<MindResult>();
  private readonly timers = useTimers();
  protected readonly cards = signal<Card[]>([]);
  protected readonly flips = signal(0);
  protected readonly pairs = signal(0);
  private open: number[] = [];
  private startedAt = 0;

  ngOnInit(): void {
    this.cards.set(shuffled([...FACES, ...FACES]).map((face) => ({ face, up: false, matched: false })));
    this.startedAt = Date.now();
  }

  protected flip(i: number): void {
    if (this.open.length >= 2) return;
    this.set(i, { up: true });
    this.open.push(i);
    if (this.open.length < 2) return;
    this.flips.update((f) => f + 1);
    const [a, b] = this.open;
    if (this.cards()[a].face === this.cards()[b].face) {
      this.set(a, { matched: true });
      this.set(b, { matched: true });
      this.open = [];
      this.pairs.update((p) => p + 1);
      if (this.pairs() === 8) {
        const seconds = Math.round((Date.now() - this.startedAt) / 1000);
        const score = Math.max(0, 100 - 5 * (this.flips() - 8));
        this.timers.after(700, () => this.done.emit({ score, detail: `${this.flips()} flips in ${seconds} seconds` }));
      }
    } else {
      this.timers.after(800, () => {
        this.set(a, { up: false });
        this.set(b, { up: false });
        this.open = [];
      });
    }
  }

  private set(i: number, patch: Partial<Card>): void {
    this.cards.update((cs) => cs.map((c, k) => (k === i ? { ...c, ...patch } : c)));
  }
}
