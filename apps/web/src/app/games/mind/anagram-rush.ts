import { ChangeDetectionStrategy, Component, OnInit, inject, output, signal } from '@angular/core';
import { WordListService } from '../word-guess/word-list.service';
import { MindResult, pick, shuffled, useClock } from './mind-util';

/** Unscramble five-letter words by tapping the letters in order. */
@Component({
  selector: 'app-anagram-rush',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './anagram-rush.html',
  styleUrls: ['./mind.scss', './anagram-rush.scss'],
})
export class AnagramRush implements OnInit {
  readonly done = output<MindResult>();
  private readonly words = inject(WordListService);
  protected readonly score = signal(0);
  protected readonly bad = signal(false);
  protected readonly letters = signal<string[]>([]);
  protected readonly used = signal<number[]>([]);
  protected readonly clock = useClock(60000, () => this.done.emit({ score: this.score(), detail: `${this.score()} words in 60 seconds` }));
  protected readonly seconds = () => Math.ceil(this.clock.left() / 1000);
  protected readonly built = () => this.used().map((i) => this.letters()[i].toUpperCase());
  private pool: string[] = [];
  private valid = new Set<string>();
  private answer = '';

  async ngOnInit(): Promise<void> {
    const w = await this.words.load();
    this.pool = w.answers;
    this.valid = w.valid;
    this.next();
    this.clock.start();
  }

  private next(): void {
    this.answer = pick(this.pool);
    let s = shuffled([...this.answer]);
    for (let k = 0; k < 6 && s.join('') === this.answer; k++) s = shuffled(s);
    this.letters.set(s);
    this.used.set([]);
  }

  protected add(i: number): void {
    this.used.update((u) => [...u, i]);
    if (this.used().length < 5) return;
    const word = this.built().join('').toLowerCase();
    // Any real word made from the letters counts, not only the one that was scrambled.
    if (word === this.answer || this.valid.has(word)) {
      this.score.update((s) => s + 1);
      this.next();
    } else {
      this.bad.set(true);
      setTimeout(() => this.bad.set(false), 300);
      this.used.set([]);
    }
  }

  protected clear(): void {
    this.used.set([]);
  }

  protected skip(): void {
    this.clock.dock(5000);
    this.next();
  }
}
