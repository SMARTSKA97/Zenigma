import { ChangeDetectionStrategy, Component, OnInit, output, signal } from '@angular/core';
import { MindResult, pick, useTimers } from './mind-util';

const SHAPES = [
  { id: 'good', glyph: '●', colour: '#2e9e5b' },
  { id: 'good', glyph: '●', colour: '#2e9e5b' },
  { id: 'bad1', glyph: '●', colour: '#d93f3f' },
  { id: 'bad2', glyph: '■', colour: '#2e9e5b' },
  { id: 'bad3', glyph: '▲', colour: '#2f6fe0' },
];

/** A go / no-go game: tap green circles only, ignore everything else. */
@Component({
  selector: 'app-target-tap',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './mind.scss',
  template: `
    <div class="hud"><span>{{ score() }} points</span><span>{{ count() }} / 40</span></div>
    <button type="button" class="big" (pointerdown)="tap()" aria-label="Tap if this is a green circle">
      @if (shape(); as s) {
        <span [style.color]="s.colour">{{ s.glyph }}</span>
      }
    </button>
    <p class="say">Tap only the green circles</p>
  `,
  styles: `
    :host .big {
      width: min(100%, 18rem);
      aspect-ratio: 1;
      border-radius: 32px;
      border: 1px solid var(--border);
      background: var(--surface);
      box-shadow: none;
      font-size: 7rem;
      line-height: 1;
      touch-action: manipulation;
    }
  `,
})
export class TargetTap implements OnInit {
  readonly done = output<MindResult>();
  private readonly timers = useTimers();
  protected readonly score = signal(0);
  protected readonly count = signal(0);
  protected readonly shape = signal<(typeof SHAPES)[number] | null>(null);
  private tapped = false;

  ngOnInit(): void {
    this.timers.after(600, () => this.next());
  }

  private next(): void {
    if (this.count() >= 40) {
      this.done.emit({ score: this.score(), detail: `${this.score()} points from 40 shapes` });
      return;
    }
    const shape = pick(SHAPES);
    this.tapped = false;
    this.count.update((c) => c + 1);
    this.shape.set(shape);
    this.timers.after(900, () => {
      // A green circle that was not tapped counts against you.
      if (shape.id === 'good' && !this.tapped) this.score.update((s) => Math.max(0, s - 1));
      this.shape.set(null);
      this.timers.after(250, () => this.next());
    });
  }

  protected tap(): void {
    const s = this.shape();
    if (!s || this.tapped) return;
    this.tapped = true;
    this.score.update((v) => (s.id === 'good' ? v + 1 : Math.max(0, v - 1)));
  }
}
