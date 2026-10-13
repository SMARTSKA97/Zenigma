import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HapticsService } from '../../core/haptics.service';
import { BackService } from '../../core/back.service';
import { formatDuration } from '../../core/leaderboard.service';
import { gameInfo, isPuzzleGame, PuzzleGameId, SPEED_GAMES } from '../../games/catalog';
import { ADAPTERS } from '../../games/puzzle/adapters';
import { levelAt } from '../../games/puzzle/level-source';
import { QueensBoard } from '../../games/queens/queens-board';
import { SudokuBoard } from '../../games/sudoku/sudoku-board';
import { ZipBoard } from '../../games/zip/zip-board';
import { PatchesBoard } from '../../games/patches/patches-board';
import { TangoBoard } from '../../games/tango/tango-board';

const ROUND_MS = 3 * 60_000;
const LEVELS = 5;
/** The pool the round draws from: the gentlest levels of each game. */
const POOL = 40;

interface Best {
  solved: number;
  ms: number;
}
const bestKey = (game: string) => `zenigma.speed.${game}`;

/** A speed round: five easy levels back to back against a three-minute clock. Your best is kept on this device. */
@Component({
  selector: 'app-speed-round',
  imports: [RouterLink, QueensBoard, TangoBoard, SudokuBoard, ZipBoard, PatchesBoard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './speed-round.html',
  styleUrl: './speed-round.scss',
})
export class SpeedRound {
  protected readonly nav = inject(BackService);
  private readonly haptics = inject(HapticsService);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap);

  protected readonly total = LEVELS;
  protected readonly none = new Set<number>();
  protected readonly games = SPEED_GAMES.map((id) => gameInfo(id)!);
  protected readonly game = computed(() => {
    const id = this.params()?.get('game') ?? '';
    return (isPuzzleGame(id) ? id : 'queens') as PuzzleGameId;
  });
  protected readonly info = computed(() => gameInfo(this.game()));
  protected readonly phase = signal<'ready' | 'playing' | 'done'>('ready');
  protected readonly puzzle = signal<unknown | null>(null);
  protected readonly state = signal<unknown | null>(null);
  protected readonly done = signal(0);
  protected readonly finalMs = signal(0);
  protected readonly newBest = signal(false);
  private readonly started = signal(0);
  private readonly now = signal(Date.now());
  protected readonly left = computed(() => Math.max(0, ROUND_MS - (this.now() - this.started())));
  protected readonly best = computed<Best | null>(() => {
    this.phase(); // re-read after a round
    try {
      return JSON.parse(localStorage.getItem(bestKey(this.game())) ?? 'null') as Best | null;
    } catch {
      return null;
    }
  });

  private order: number[] = [];
  private timer?: ReturnType<typeof setInterval>;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearInterval(this.timer));
  }

  /** The track the levels come from: Sudoku uses the mini grid's easy tier. */
  private track(): string {
    return this.game() === 'sudoku' ? 'sudoku-mini-easy' : this.game();
  }

  protected fmt(ms: number): string {
    return formatDuration(ms);
  }

  protected async start(): Promise<void> {
    clearInterval(this.timer);
    // Five different levels from the easy pool, in random order.
    const pool = Array.from({ length: POOL }, (_, i) => i + 1);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    this.order = pool.slice(0, LEVELS);
    this.done.set(0);
    this.newBest.set(false);
    this.puzzle.set(null);
    this.state.set(null);
    this.phase.set('playing');
    await this.load(0);
    this.started.set(Date.now());
    this.now.set(Date.now());
    this.timer = setInterval(() => {
      this.now.set(Date.now());
      if (this.left() <= 0) this.finish();
    }, 200);
  }

  private async load(i: number): Promise<void> {
    const puzzle = await levelAt(this.track(), this.order[i]);
    this.puzzle.set(puzzle);
    this.state.set(puzzle ? ADAPTERS[this.game()].blank(puzzle) : null);
  }

  protected change(next: unknown): void {
    this.state.set(next);
    const p = this.puzzle();
    if (!p || !ADAPTERS[this.game()].isSolved(p, next)) return;
    this.haptics.place();
    const n = this.done() + 1;
    this.done.set(n);
    if (n >= LEVELS) this.finish();
    else void this.load(n);
  }

  private finish(): void {
    clearInterval(this.timer);
    const ms = Math.min(ROUND_MS, Date.now() - this.started());
    this.finalMs.set(ms);
    const solved = this.done();
    const prev = this.best();
    const better = !prev || solved > prev.solved || (solved === prev.solved && solved === LEVELS && ms < prev.ms);
    if (better && solved > 0) {
      this.newBest.set(true);
      try {
        localStorage.setItem(bestKey(this.game()), JSON.stringify({ solved, ms }));
      } catch {
        /* storage unavailable: the best is not kept */
      }
    }
    if (solved === LEVELS) this.haptics.success();
    else this.haptics.warning();
    this.phase.set('done');
  }
}
