import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Stats } from '../core/stats.service';
import { DAILY_GAMES } from '../games/catalog';
import { Glyph } from './glyph';
import { Sheet } from './sheet';

/** Streak freezes game by game: how many each has, and how far it is from the next. */
@Component({
  selector: 'app-freeze-list',
  imports: [Glyph],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './freeze-list.html',
  styleUrl: './freeze-list.scss',
})
export class FreezeList {
  readonly stats = input.required<Stats>();

  protected readonly slots = computed(() => Array.from({ length: this.stats().rewards.maxFreezes }, (_, i) => i));
  protected readonly days = computed(() => Array.from({ length: this.stats().rewards.daysPerFreeze }, (_, i) => i));
  protected readonly rows = computed(() => {
    const per = this.stats().rewards.daysPerFreeze;
    return DAILY_GAMES.map((game) => {
      const s = this.stats().games.find((g) => g.game === game.id);
      return {
        id: game.id,
        name: game.name,
        hue: game.hue,
        freezes: s?.freezes ?? 0,
        next: s?.nextFreezeIn ?? per,
        progress: per - (s?.nextFreezeIn ?? per),
      };
    });
  });
}

@Component({
  selector: 'app-freeze-sheet',
  imports: [Sheet, FreezeList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './freeze-sheet.html',
})
export class FreezeSheet {
  readonly stats = input.required<Stats>();
  readonly closed = output<void>();
}
