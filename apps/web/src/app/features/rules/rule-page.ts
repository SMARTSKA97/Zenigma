import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { gameInfo, isPuzzleGame } from '../../games/catalog';
import { Glyph } from '../../shared/glyph';
import { RuleFigure } from './rule-figure';
import { GAME_RULES, RULES_BY_ID } from './rules-data';

/** In-depth rules for one game: goal, rules, a worked example, techniques, mistakes and tips. */
@Component({
  selector: 'app-rule-page',
  imports: [RouterLink, RuleFigure, Glyph],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rule-page.html',
  styleUrl: './rule-page.scss',
})
export class RulePage {
  private readonly route = inject(ActivatedRoute);
  private readonly id = toSignal(this.route.paramMap.pipe(map((p) => p.get('game') ?? '')), { initialValue: '' });

  protected readonly rules = computed(() => RULES_BY_ID.get(this.id()) ?? null);
  protected readonly hue = computed(() => gameInfo(this.id())?.hue ?? 160);
  protected readonly playLink = computed(() => (this.id() === 'word-guess' ? '/games/word-guess' : isPuzzleGame(this.id()) ? ['/games', this.id()] : '/practice'));
  protected readonly nextGame = computed(() => {
    const i = GAME_RULES.findIndex((g) => g.id === this.id());
    return i >= 0 && i < GAME_RULES.length - 1 ? GAME_RULES[i + 1] : null;
  });
}
