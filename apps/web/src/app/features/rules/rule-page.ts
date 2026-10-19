import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { gameInfo, isPuzzleGame } from '../../games/catalog';
import { MIND_META } from '../../games/mind/mind-meta';
import { MindGameId } from '../../games/catalog';
import { DemoPlayer } from './demo-player';
import { demoFor } from './demo-data';
import { Glyph } from '../../shared/glyph';
import { RuleFigure } from './rule-figure';
import { GAME_RULES, RULES_BY_ID } from './rules-data';

/** In-depth rules for one game: goal, rules, a worked example, techniques, mistakes and tips. */
@Component({
  selector: 'app-rule-page',
  imports: [RouterLink, RuleFigure, Glyph, DemoPlayer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rule-page.html',
  styleUrl: './rule-page.scss',
})
export class RulePage {
  private readonly route = inject(ActivatedRoute);
  protected readonly id = toSignal(this.route.paramMap.pipe(map((p) => p.get('game') ?? '')), { initialValue: '' });

  protected readonly rules = computed(() => RULES_BY_ID.get(this.id()) ?? null);
  protected readonly hue = computed(() => gameInfo(this.id())?.hue ?? 160);
  /** A mind game has no long rules page, just what to do and a demo. */
  protected readonly mind = computed(() => MIND_META[this.id() as MindGameId] ?? null);
  protected readonly info = computed(() => gameInfo(this.id()));
  protected readonly situations = computed(() => (demoFor(this.id())?.frames ?? []).filter((f) => f.when).map((f) => f.when!.split('→').map((x) => x.trim())));
  protected readonly playLink = computed(() => (this.id() === 'word-guess' ? '/games/word-guess' : isPuzzleGame(this.id()) ? ['/games', this.id()] : this.mind() ? ['/mind', this.id()] : '/practice'));
  protected readonly nextGame = computed(() => {
    const i = GAME_RULES.findIndex((g) => g.id === this.id());
    return i >= 0 && i < GAME_RULES.length - 1 ? GAME_RULES[i + 1] : null;
  });
}
