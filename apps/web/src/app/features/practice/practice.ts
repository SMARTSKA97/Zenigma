import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GAMES, isPuzzleGame, PRACTICE_TRACKS, practiceEntry } from '../../games/catalog';
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
    <div class="grid">
      @for (game of games; track game.id) {
        @if (game.live) {
          <a class="game live" [routerLink]="link(game.id)" [style.--h]="game.hue">
            <span class="art"><app-glyph [game]="game.id" /></span>
            <span class="name">{{ game.name }}</span>
            <span class="blurb">{{ game.blurb }}</span>
            <span class="tag play-tag">{{ progress(game.id) }}</span>
          </a>
        } @else {
          <div class="game" [style.--h]="game.hue">
            <span class="art"><app-glyph [game]="game.id" /></span>
            <span class="name">{{ game.name }}</span>
            <span class="blurb">{{ game.blurb }}</span>
            <span class="tag">Coming soon</span>
          </div>
        }
      }
    </div>
  `,
  styleUrl: './practice.scss',
})
export class Practice implements OnInit {
  private readonly practice = inject(PracticeStore);
  protected readonly games = GAMES;
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
