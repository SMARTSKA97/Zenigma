import { ChangeDetectionStrategy, Component, OnInit, output, signal } from '@angular/core';
import { MindResult, pick, shuffled, useClock } from './mind-util';

const PAIRS: [string, string][] = [
  ['hot', 'cold'], ['up', 'down'], ['big', 'small'], ['fast', 'slow'], ['happy', 'sad'], ['early', 'late'], ['open', 'closed'],
  ['light', 'dark'], ['full', 'empty'], ['strong', 'weak'], ['old', 'young'], ['rich', 'poor'], ['loud', 'quiet'], ['hard', 'soft'],
  ['wet', 'dry'], ['clean', 'dirty'], ['near', 'far'], ['thick', 'thin'], ['brave', 'afraid'], ['win', 'lose'], ['push', 'pull'],
  ['love', 'hate'], ['begin', 'end'], ['arrive', 'leave'], ['buy', 'sell'], ['accept', 'refuse'], ['ancient', 'modern'], ['expand', 'shrink'],
  ['generous', 'selfish'], ['victory', 'defeat'], ['rough', 'smooth'], ['public', 'private'], ['permit', 'forbid'], ['scatter', 'gather'],
];

/** A word is shown. Pick its opposite from four words. */
@Component({
  selector: 'app-opposites',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './mind.scss',
  templateUrl: './opposites.html',
})
export class Opposites implements OnInit {
  readonly done = output<MindResult>();
  protected readonly score = signal(0);
  protected readonly bad = signal(false);
  protected readonly clock = useClock(60000, () => this.done.emit({ score: this.score(), detail: `${this.score()} opposites in 60 seconds` }));
  protected readonly q = signal(this.make());
  protected readonly seconds = () => Math.ceil(this.clock.left() / 1000);
  private last = '';

  ngOnInit(): void {
    this.clock.start();
  }

  protected answer(word: string): void {
    if (word === this.q().answer) this.score.update((s) => s + 1);
    else {
      this.clock.dock(3000);
      this.bad.set(true);
      setTimeout(() => this.bad.set(false), 300);
    }
    this.q.set(this.make());
  }

  private make() {
    let pair: [string, string];
    do pair = pick(PAIRS);
    while (pair[0] === this.last);
    this.last = pair[0];
    const flip = Math.random() < 0.5;
    const [word, answer] = flip ? [pair[1], pair[0]] : pair;
    const others = shuffled(PAIRS.flat().filter((w) => w !== word && w !== answer)).slice(0, 3);
    return { word, answer, options: shuffled([answer, ...others]) };
  }
}
