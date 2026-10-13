import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { GameId, gameInfo } from '../games/catalog';

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
  /** Puzzle and word games have their own drawing; each mind game is drawn for the skill it trains. */
  protected readonly kind = computed(() => {
    const info = gameInfo(this.game());
    return info?.category === 'mind' && info.skill ? `skill-${info.skill}` : this.game();
  });
}
