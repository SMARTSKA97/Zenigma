import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CATEGORIES, GAMES, SKILLS, SPEED_GAMES, isPuzzleGame, PRACTICE_TRACKS, practiceEntry, soonKindsOf } from '../../games/catalog';
import { ChallengeStrip } from '../challenges/challenges';
import { Segmented } from '../../shared/segmented';
import { MindStore } from '../../games/mind/mind-store';
import { MIND_META } from '../../games/mind/mind-meta';
import { SkillBars } from './skill-bars';
import { MindGameId } from '../../games/catalog';
import { PracticeStore } from '../../games/puzzle/practice.store';
import { Glyph } from '../../shared/glyph';
import { HintWheel } from '../../shared/hint-wheel';
import { HintsService } from '../../core/hints.service';

/** Practice: every game, endless levels, no pressure. Games with variants (Sudoku) open a chooser first. */
@Component({
  selector: 'app-practice',
  imports: [RouterLink, Glyph, HintWheel, ChallengeStrip, Segmented, SkillBars],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Practice</h1>
    <p class="muted sub">Endless levels, no pressure. Works offline. Each level is the same for everyone.</p>
    <button type="button" class="wheel-card" (click)="wheel.set(true)">
      <span class="bulb" aria-hidden="true">💡</span>
      <span class="txt">
        <b>{{ hints.balance() }} hint{{ hints.balance() === 1 ? '' : 's' }}</b>
        <span>{{ hints.canSpin() ? 'Your daily spin is ready' : 'Next spin tomorrow. Challenges and every 10th level earn more.' }}</span>
      </span>
      @if (hints.canSpin()) {
        <span class="go">Spin</span>
      }
    </button>
    @if (wheel()) {
      <app-hint-wheel (closed)="wheel.set(false)" />
    }
    <app-challenge-strip />

    <app-segmented class="tabs" label="Practice" [options]="tabs" [(value)]="tab" />

    @if (tab() === 'play') {
      @for (cat of playable; track cat.id) {
        <h2 class="sec">{{ cat.name }}</h2>
        @if (cat.id === 'mind') {
          <app-skill-bars />
        }
        <div class="grid">
          @for (game of cat.games; track game.id) {
            <a class="game live" [routerLink]="link(game.id)" [style.--h]="game.hue">
              <span class="art"><app-glyph [game]="game.id" /></span>
              <span class="name">{{ game.name }}</span>
              <span class="blurb">{{ game.blurb }}</span>
              <span class="tag play-tag">{{ progress(game.id) }}</span>
            </a>
          }
        </div>
      }

      <h2 class="sec">Speed round</h2>
      <p class="muted sub2">Five easy levels, three minutes. Beat your best.</p>
      <div class="speed">
        @for (g of speedGames; track g.id) {
          <a class="speed-chip" [routerLink]="['/speed', g.id]" [style.--h]="g.hue">⚡ {{ g.name }}</a>
        }
      </div>
      <p class="muted more">More on the way: <button type="button" class="link" (click)="tab.set('soon')">see what is coming soon</button></p>
    } @else {
      <h2 class="sec">Mind training, still to come</h2>
      <p class="muted sub2">More short exercises for memory, focus, speed and maths are on the way.</p>
      @for (s of mind; track s.skill.id) {
        <section class="skill">
          <h3>{{ s.skill.emoji }} {{ s.skill.name }}</h3>
          <div class="mlist">
            @for (g of s.games; track g.id) {
              <div class="mrow" [style.--h]="g.hue">
                <span class="art"><app-glyph [game]="g.id" /></span>
                <span class="mtext"><b>{{ g.name }}</b><span class="muted">{{ g.blurb }}</span></span>
              </div>
            }
          </div>
        </section>
      }

      @if (soonWords.length) {
        <h2 class="sec">New word games</h2>
        <div class="mlist">
          @for (g of soonWords; track g.id) {
            <div class="mrow" [style.--h]="g.hue">
              <span class="art"><app-glyph [game]="g.id" /></span>
              <span class="mtext"><b>{{ g.name }}</b><span class="muted">{{ g.blurb }}</span></span>
            </div>
          }
        </div>
      }

      <h2 class="sec">More kinds of the games you know</h2>
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
    }
  `,
  styleUrl: './practice.scss',
})
export class Practice implements OnInit {
  private readonly practice = inject(PracticeStore);
  private readonly mindStore = inject(MindStore);
  protected readonly tabs: { value: 'play' | 'soon'; label: string }[] = [
    { value: 'play', label: 'Play' },
    { value: 'soon', label: 'Coming soon' },
  ];
  protected readonly tab = signal<'play' | 'soon'>('play');
  /** Live games by category (logic puzzles, Sudoku, words). */
  protected readonly playable = CATEGORIES.map((c) => ({ ...c, games: GAMES.filter((g) => g.live && g.category === c.id) })).filter((c) => c.games.length > 0);
  protected readonly speedGames = SPEED_GAMES.map((id) => GAMES.find((g) => g.id === id)!);
  /** Mind-training games on the way, by the skill they train. */
  protected readonly mind = SKILLS.map((skill) => ({ skill, games: GAMES.filter((g) => !g.live && g.category === 'mind' && g.skill === skill.id) })).filter((s) => s.games.length > 0);
  protected readonly soonWords = GAMES.filter((g) => !g.live && g.category === 'word');
  /** New kinds of games that are live: the ones set in the catalog, plus Sudoku's championship kinds. */
  protected readonly soonKinds = GAMES.filter((g) => g.live)
    .map((game) => ({ game, kinds: soonKindsOf(game.id) }))
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
    const meta = MIND_META[id as MindGameId];
    if (meta) {
      const rec = this.mindStore.record(id);
      return rec.plays ? `Best ${meta.format ? meta.format(rec.best) : rec.best}` : 'Play';
    }
    if (!isPuzzleGame(id)) return 'Play';
    const tracks = PRACTICE_TRACKS.filter((t) => t.game === id);
    const solved = tracks.reduce((n, t) => n + this.practice.solvedLevels(t.track)().size, 0);
    if (!solved) return 'Play';
    return tracks.length > 1 ? `${solved} levels solved` : `Level ${this.practice.frontier(tracks[0].track)}`;
  }
}
