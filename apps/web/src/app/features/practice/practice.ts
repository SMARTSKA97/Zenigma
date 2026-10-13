import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GAMES, SPEED_GAMES, isPuzzleGame, PRACTICE_TRACKS, practiceEntry, SOON_KINDS, variantsOf } from '../../games/catalog';
import { PracticeStore } from '../../games/puzzle/practice.store';
import { Glyph } from '../../shared/glyph';
import { HintWheel } from '../../shared/hint-wheel';
import { HintsService } from '../../core/hints.service';

/** Practice: every game, endless levels, no pressure. Games with variants (Sudoku) open a chooser first. */
@Component({
  selector: 'app-practice',
  imports: [RouterLink, Glyph, HintWheel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Practice</h1>
    <p class="muted sub">Endless levels, no pressure. Works offline. Each level is the same for everyone.</p>
    <button type="button" class="wheel-card" (click)="wheel.set(true)">
      <span class="bulb" aria-hidden="true">💡</span>
      <span class="txt">
        <b>{{ hints.balance() }} hint{{ hints.balance() === 1 ? '' : 's' }}</b>
        <span>{{ hints.canSpin() ? 'Your daily spin is ready' : 'Next spin tomorrow. Clear every 10th level for more.' }}</span>
      </span>
      @if (hints.canSpin()) {
        <span class="go">Spin</span>
      }
    </button>
    @if (wheel()) {
      <app-hint-wheel (closed)="wheel.set(false)" />
    }
    <h2 class="sec">Play</h2>
    <div class="grid">
      @for (game of live; track game.id) {
        <a class="game live" [routerLink]="link(game.id)" [style.--h]="game.hue">
          <span class="art"><app-glyph [game]="game.id" /></span>
          <span class="name">{{ game.name }}</span>
          <span class="blurb">{{ game.blurb }}</span>
          <span class="tag play-tag">{{ progress(game.id) }}</span>
        </a>
      }
    </div>

    <h2 class="sec">Speed round</h2>
    <p class="muted sub2">Five easy levels, three minutes. Beat your best.</p>
    <div class="speed">
      @for (g of speedGames; track g.id) {
        <a class="speed-chip" [routerLink]="['/speed', g.id]" [style.--h]="g.hue">⚡ {{ g.name }}</a>
      }
    </div>

    <h2 class="sec">Coming soon</h2>
    <p class="muted sub2">New games and new kinds of the ones you know.</p>
    <div class="grid">
      @for (game of soon; track game.id) {
        <div class="game" [style.--h]="game.hue">
          <span class="art"><app-glyph [game]="game.id" /></span>
          <span class="name">{{ game.name }}</span>
          <span class="blurb">{{ game.blurb }}</span>
          <span class="tag">New game</span>
        </div>
      }
    </div>
    <div class="kinds">
      @for (g of soonKinds; track g.game.id) {
        <section class="kind-card" [style.--h]="g.game.hue">
          <h3>More {{ g.game.name }}</h3>
          <ul>
            @for (k of g.kinds; track k.name) {
              <li><b>{{ k.name }}</b> <span class="muted">{{ k.blurb }}</span></li>
            }
          </ul>
        </section>
      }
    </div>
  `,
  styleUrl: './practice.scss',
})
export class Practice implements OnInit {
  private readonly practice = inject(PracticeStore);
  protected readonly live = GAMES.filter((g) => g.live);
  protected readonly speedGames = SPEED_GAMES.map((id) => GAMES.find((g) => g.id === id)!);
  protected readonly soon = GAMES.filter((g) => !g.live);
  /** New kinds of games that are live: the ones set in the catalog, plus Sudoku's championship kinds. */
  protected readonly soonKinds = GAMES.filter((g) => g.live)
    .map((game) => ({
      game,
      kinds: [
        ...(SOON_KINDS[game.id] ?? []),
        ...variantsOf(game.id)
          .filter((v) => v.soon)
          .map((v) => ({ name: v.name, blurb: v.blurb })),
      ],
    }))
    .filter((g) => g.kinds.length > 0);
  protected readonly hints = inject(HintsService);
  protected readonly wheel = signal(false);

  ngOnInit(): void {
    for (const t of PRACTICE_TRACKS) void this.practice.load(t.track);
  }

  protected link(id: string): string[] {
    return practiceEntry(id);
  }

  protected progress(id: string): string {
    if (!isPuzzleGame(id)) return 'Play';
    const tracks = PRACTICE_TRACKS.filter((t) => t.game === id);
    const solved = tracks.reduce((n, t) => n + this.practice.solvedLevels(t.track)().size, 0);
    if (!solved) return 'Play';
    return tracks.length > 1 ? `${solved} levels solved` : `Level ${this.practice.frontier(tracks[0].track)}`;
  }
}
