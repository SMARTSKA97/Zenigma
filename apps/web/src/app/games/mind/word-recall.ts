import { ChangeDetectionStrategy, Component, OnInit, output, signal } from '@angular/core';
import { MindResult, shuffled, useTimers } from './mind-util';

const WORDS = ['apple', 'river', 'candle', 'window', 'tiger', 'basket', 'pencil', 'garden', 'mirror', 'violin', 'ladder', 'planet', 'button', 'castle', 'rocket', 'island', 'pillow', 'anchor', 'lemon', 'wallet', 'helmet', 'bridge', 'cactus', 'dragon', 'hammer', 'jacket', 'kettle', 'magnet', 'needle', 'orange', 'parrot', 'ribbon', 'saddle', 'tunnel', 'wagon'];

/** A few words appear for a moment. Then pick them out from a longer list. One more word each round; three lives. */
@Component({
  selector: 'app-word-recall',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './mind.scss',
  templateUrl: './word-recall.html',
})
export class WordRecall implements OnInit {
  readonly done = output<MindResult>();
  private readonly timers = useTimers();
  protected readonly level = signal(1);
  protected readonly lives = signal(3);
  protected readonly phase = signal<'show' | 'pick' | 'over'>('show');
  protected readonly shown = signal<string[]>([]);
  protected readonly choices = signal<string[]>([]);
  protected readonly chosen = signal<Set<string>>(new Set());
  protected readonly right = signal<Set<string>>(new Set());
  protected readonly count = () => this.shown().length;

  ngOnInit(): void {
    this.start();
  }

  private start(): void {
    const n = Math.min(9, 2 + this.level());
    const pool = shuffled(WORDS);
    this.shown.set(pool.slice(0, n));
    this.choices.set(shuffled(pool.slice(0, Math.min(WORDS.length, n + 6))));
    this.chosen.set(new Set());
    this.right.set(new Set());
    this.phase.set('show');
    this.timers.after(1500 + n * 650, () => this.phase.set('pick'));
  }

  protected toggle(word: string): void {
    if (this.phase() !== 'pick') return;
    const next = new Set(this.chosen());
    if (next.has(word)) next.delete(word);
    else next.add(word);
    this.chosen.set(next);
    if (next.size < this.count()) return;
    const ok = [...next].every((w) => this.shown().includes(w));
    this.right.set(new Set(this.shown()));
    this.phase.set('over');
    if (ok) {
      this.timers.after(700, () => {
        this.level.update((l) => l + 1);
        this.start();
      });
      return;
    }
    this.lives.update((l) => l - 1);
    this.timers.after(1300, () => {
      if (this.lives() <= 0) {
        const score = this.level() - 1;
        this.done.emit({ score, detail: `You remembered up to ${score + 2} words` });
      } else this.start();
    });
  }
}
