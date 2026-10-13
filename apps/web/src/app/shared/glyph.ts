import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { GameId } from '../games/catalog';

/** One small line drawing per game, so each tile is recognisable at a glance. */
@Component({
  selector: 'app-glyph',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  templateUrl: './glyph.html',
  styleUrl: './glyph.scss',
})
export class Glyph {
  readonly game = input.required<GameId>();
}
