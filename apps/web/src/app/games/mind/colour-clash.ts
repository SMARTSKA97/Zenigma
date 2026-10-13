import { ChangeDetectionStrategy, Component, OnInit, output, signal } from '@angular/core';
import { MindResult, pick, useClock } from './mind-util';

const COLOURS = [
  { name: 'Red', css: '#d93f3f' },
  { name: 'Blue', css: '#2f6fe0' },
  { name: 'Green', css: '#2e9e5b' },
  { name: 'Yellow', css: '#d8a800' },
];

/** The Stroop test: tap the colour of the ink, not the colour the word names. */
@Component({
  selector: 'app-colour-clash',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './mind.scss',
  templateUrl: './colour-clash.html',
})
export class ColourClash implements OnInit {
  readonly done = output<MindResult>();
  protected readonly colours = COLOURS;
  protected readonly score = signal(0);
  protected readonly bad = signal(false);
  protected readonly clock = useClock(45000, () => this.done.emit({ score: this.score(), detail: `${this.score()} correct in 45 seconds` }));
  protected readonly round = signal(this.make());
  protected readonly seconds = () => Math.ceil(this.clock.left() / 1000);

  ngOnInit(): void {
    this.clock.start();
  }

  protected answer(name: string): void {
    if (name === this.round().ink.name) {
      this.score.update((s) => s + 1);
    } else {
      this.clock.dock(3000);
      this.bad.set(true);
      setTimeout(() => this.bad.set(false), 300);
    }
    this.round.set(this.make());
  }

  private make() {
    const word = pick(COLOURS);
    // Mostly a clash, sometimes a match, so the habit of reading does not give the answer away.
    const ink = Math.random() < 0.8 ? pick(COLOURS.filter((c) => c !== word)) : word;
    return { word, ink };
  }
}
