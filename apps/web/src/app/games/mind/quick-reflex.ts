import { ChangeDetectionStrategy, Component, output, signal } from '@angular/core';
import { MindResult, randInt, useTimers } from './mind-util';

/** Tap the moment the screen turns green. Five rounds, then the average. */
@Component({
  selector: 'app-quick-reflex',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quick-reflex.html',
  styleUrls: ['./mind.scss', './quick-reflex.scss'],
})
export class QuickReflex {
  readonly done = output<MindResult>();
  private readonly timers = useTimers();
  protected readonly state = signal<'idle' | 'wait' | 'go' | 'early' | 'result'>('idle');
  protected readonly times = signal<number[]>([]);
  protected readonly round = () => Math.min(5, this.times().length + 1);
  private goAt = 0;

  protected tap(): void {
    const s = this.state();
    if (s === 'idle' || s === 'early' || s === 'result') {
      if (s === 'result' && this.times().length >= 5) return;
      this.state.set('wait');
      this.timers.after(randInt(1500, 4000), () => {
        this.goAt = performance.now();
        this.state.set('go');
      });
    } else if (s === 'wait') {
      this.timers.clear();
      this.state.set('early');
    } else if (s === 'go') {
      const ms = Math.round(performance.now() - this.goAt);
      this.times.update((t) => [...t, ms]);
      if (this.times().length >= 5) {
        const avg = Math.round(this.times().reduce((a, b) => a + b, 0) / 5);
        this.state.set('result');
        this.timers.after(900, () => this.done.emit({ score: Math.max(0, 1000 - avg), detail: `Average ${avg} ms, best ${Math.min(...this.times())} ms` }));
      } else {
        this.state.set('result');
      }
    }
  }
}
