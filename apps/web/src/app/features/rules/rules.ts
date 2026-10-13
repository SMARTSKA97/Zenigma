import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { gameInfo } from '../../games/catalog';
import { Glyph } from '../../shared/glyph';
import { GAME_RULES } from './rules-data';

/** The rules hub: one card per game (each opens that game's full rules), plus how hints, Check and freezes work. */
@Component({
  selector: 'app-rules',
  imports: [RouterLink, Glyph],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rules.html',
  styleUrl: './rules.scss',
})
export class Rules {
  protected readonly games = GAME_RULES.map((g) => ({ ...g, hue: gameInfo(g.id)?.hue ?? 160 }));
}
