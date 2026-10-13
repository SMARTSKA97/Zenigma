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
  template: `
    <header class="top">
      <a class="round" href="/" aria-label="Back" (click)="nav.up($event)">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
      </a>
      <div class="title">
        <h1>Speed round · {{ info()?.name }}</h1>
        <p class="muted">Solve {{ total }} easy levels in 3 minutes</p>
      </div>
    </header>

    @if (phase() === 'ready') {
      <section class="card intro">
        <p>Five quick levels, one clock. Solve as many as you can before three minutes run out.</p>
        @if (best(); as b) {
          <p class="muted">Your best: {{ b.solved }} of {{ total }}{{ b.solved === total ? ' in ' + fmt(b.ms) : '' }}</p>
        }
        <button type="button" (click)="start()">Start</button>
        <div class="others">
          @for (g of games; track g.id) {
            <a [routerLink]="['/speed', g.id]" [class.on]="g.id === game()">{{ g.name }}</a>
          }
        </div>
      </section>
    } @else if (phase() === 'playing') {
      <div class="bar">
        <span class="clock" [class.low]="left() < 30_000">{{ fmt(left()) }}</span>
        <span class="count">{{ done() }} / {{ total }} solved</span>
      </div>
      <div class="board">
        @if (puzzle(); as p) {
          @switch (game()) {
            @case ('queens') { <app-queens-board [puzzle]="$any(p)" [board]="$any(state())" [bad]="none" [locked]="false" [solved]="false" (boardChange)="change($event)" /> }
            @case ('tango') { <app-tango-board [puzzle]="$any(p)" [board]="$any(state())" [bad]="none" [locked]="false" [solved]="false" (boardChange)="change($event)" /> }
            @case ('zip') { <app-zip-board [puzzle]="$any(p)" [board]="$any(state())" [bad]="none" [locked]="false" [solved]="false" (boardChange)="change($event)" /> }
            @case ('patches') { <app-patches-board [puzzle]="$any(p)" [board]="$any(state())" [bad]="none" [locked]="false" [solved]="false" (boardChange)="change($event)" /> }
            @case ('sudoku') { <app-sudoku-board [puzzle]="$any(p)" [board]="$any(state())" [bad]="none" [locked]="false" [solved]="false" (boardChange)="change($event)" /> }
          }
        } @else {
          <p class="muted">Loading</p>
        }
      </div>
    } @else {
      <section class="card result">
        <h2>{{ done() === total ? 'All ' + total + ' solved!' : done() + ' of ' + total + ' solved' }}</h2>
        <p class="muted">{{ done() === total ? 'in ' + fmt(finalMs()) : 'Time ran out' }}</p>
        @if (newBest()) {
          <p class="pb">New personal best</p>
        }
        <div class="actions">
          <button type="button" (click)="start()">Go again</button>
          <a class="button secondary" routerLink="/practice">Practice</a>
        </div>
      </section>
    }
  `,
  styles: `
    :host {
      display: block;
      max-width: 36rem;
      margin: 0 auto;
    }
    .top {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }
    .top h1 {
      margin: 0;
      font-size: 1.15rem;
    }
    .top p {
      margin: 0;
      font-size: 0.85rem;
    }
    .round {
      display: grid;
      place-items: center;
      width: 2.6rem;
      height: 2.6rem;
      border-radius: 50%;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text);
    }
    .round svg {
      width: 1.2rem;
      height: 1.2rem;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .card {
      padding: 1.1rem;
      border-radius: var(--radius);
      border: 1px solid var(--border);
      background: var(--surface);
      display: grid;
      gap: 0.75rem;
      justify-items: center;
      text-align: center;
    }
    .others {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      justify-content: center;
    }
    .others a {
      padding: 0.3rem 0.8rem;
      border-radius: 999px;
      background: var(--surface-2);
      color: var(--text);
      text-decoration: none;
      font-size: 0.85rem;
    }
    .others a.on {
      background: var(--accent);
      color: var(--accent-contrast);
    }
    .bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
      font-weight: 700;
    }
    .clock {
      font-family: var(--font-display);
      font-size: 1.6rem;
      font-variant-numeric: tabular-nums;
    }
    .clock.low {
      color: var(--bad, #c0392b);
    }
    .pb {
      margin: 0;
      color: var(--good);
      font-weight: 700;
    }
    .actions {
      display: flex;
      gap: 0.5rem;
    }
  `,
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
