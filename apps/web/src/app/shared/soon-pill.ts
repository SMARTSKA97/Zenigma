import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { soonKindsOf } from '../games/catalog';
import { Sheet } from './sheet';

/** A small "More kinds soon" pill for a game's page. Opens a sheet listing what is on the way. Hidden when nothing is. */
@Component({
  selector: 'app-soon-pill',
  imports: [Sheet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './soon-pill.html',
  styleUrl: './soon-pill.scss',
})
export class SoonPill {
  readonly game = input.required<string>();
  protected readonly open = signal(false);
  protected readonly kinds = computed(() => soonKindsOf(this.game()));
}
