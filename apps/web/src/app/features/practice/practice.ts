import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CATEGORIES, GAMES, MIND_LIVE, SKILLS, SPEED_GAMES, isPuzzleGame, PRACTICE_TRACKS, practiceEntry, soonKindsOf } from '../../games/catalog';
import { MindStore } from '../../games/mind/mind-store';
import { MIND_META } from '../../games/mind/mind-meta';
import { MindGameId } from '../../games/catalog';
import { PracticeStore } from '../../games/puzzle/practice.store';
import { Glyph } from '../../shared/glyph';
import { HintWheel } from '../../shared/hint-wheel';
import { HintsService } from '../../core/hints.service';

/** Practice: every game, endless levels, no pressure. Games with variants (Sudoku) open a chooser first. */
@Component({
  selector: 'app-practice',
  imports: [RouterLink, Glyph, HintWheel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './practice.html',
  styleUrl: './practice.scss',
})
export class Practice implements OnInit {
  private readonly practice = inject(PracticeStore);
  private readonly mindStore = inject(MindStore);
  protected readonly mindCount = MIND_LIVE.length;
  protected readonly cats = [{ id: 'all', name: 'All' }, ...CATEGORIES.filter((c) => c.id !== 'mind')];
  protected readonly cat = signal<string>('all');
  /** Live games by category (logic puzzles, Sudoku, words). Mind training has its own page. */
  protected readonly playable = computed(() =>
    CATEGORIES.filter((c) => c.id !== 'mind' && (this.cat() === 'all' || this.cat() === c.id))
      .map((c) => ({ ...c, games: GAMES.filter((g) => g.live && g.category === c.id) }))
      .filter((c) => c.games.length > 0),
  );
  protected readonly speedGames = SPEED_GAMES.map((id) => GAMES.find((g) => g.id === id)!);
  /** Mind-training games on the way, by the skill they train. */
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

  protected kindNames(kinds: { name: string }[]): string {
    return kinds.map((k) => k.name).join(', ');
  }
}
