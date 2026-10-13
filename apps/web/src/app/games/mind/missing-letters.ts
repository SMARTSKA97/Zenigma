import { ChangeDetectionStrategy, Component, OnInit, inject, output, signal } from '@angular/core';
import { WordListService } from '../word-guess/word-list.service';
import { MindResult, pick, randInt, shuffled, useClock } from './mind-util';

interface Question {
  shown: string;
  options: string[];
  answer: string;
}

const PAIRS = ['ar', 'er', 'or', 'ea', 'ou', 'ai', 'st', 'ch', 'th', 'in', 'an', 'on', 'ol', 'ig', 'ul', 're', 'oo', 'ra', 'ri', 'ne'];

/** A word with two neighbouring letters missing. Pick the pair that makes a real word. */
@Component({
  selector: 'app-missing-letters',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './mind.scss',
  template: `
    <div class="hud"><span>{{ score() }} words</span><span>{{ seconds() }}s</span></div>
    <div class="time"><i [style.width.%]="(clock.left() / 60000) * 100"></i></div>
    <div class="prompt" [class.flash-bad]="bad()">{{ q().shown }}</div>
    <div class="options">
      @for (o of q().options; track o) {
        <button type="button" class="opt" (click)="answer(o)">{{ o.toUpperCase() }}</button>
      }
    </div>
  `,
})
export class MissingLetters implements OnInit {
  readonly done = output<MindResult>();
  private readonly words = inject(WordListService);
  protected readonly score = signal(0);
  protected readonly bad = signal(false);
  protected readonly q = signal<Question>({ shown: '·····', options: [], answer: '' });
  protected readonly clock = useClock(60000, () => this.done.emit({ score: this.score(), detail: `${this.score()} words in 60 seconds` }));
  protected readonly seconds = () => Math.ceil(this.clock.left() / 1000);
  private pool: string[] = [];
  private valid = new Set<string>();

  async ngOnInit(): Promise<void> {
    const w = await this.words.load();
    this.pool = w.answers;
    this.valid = w.valid;
    this.q.set(this.make());
    this.clock.start();
  }

  protected answer(o: string): void {
    if (o === this.q().answer) {
      this.score.update((s) => s + 1);
    } else {
      this.clock.dock(3000);
      this.bad.set(true);
      setTimeout(() => this.bad.set(false), 300);
    }
    this.q.set(this.make());
  }

  private make(): Question {
    for (;;) {
      const word = pick(this.pool);
      const at = randInt(0, 3);
      const answer = word.slice(at, at + 2);
      const stem = (pair: string) => word.slice(0, at) + pair + word.slice(at + 2);
      // Distractors must not also spell a real word.
      const wrong = shuffled(PAIRS.filter((p) => p !== answer && !this.valid.has(stem(p)))).slice(0, 3);
      if (wrong.length < 3) continue;
      return { shown: word.slice(0, at).toUpperCase() + '＿＿' + word.slice(at + 2).toUpperCase(), options: shuffled([answer, ...wrong]), answer };
    }
  }
}
