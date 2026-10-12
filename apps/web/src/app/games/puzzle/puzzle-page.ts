import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HapticsService } from '../../core/haptics.service';
import { AuthService } from '../../core/auth.service';
import { formatDuration } from '../../core/leaderboard.service';
import { LocalStore } from '../../core/local-store';
import { SyncService } from '../../core/sync.service';
import { Confetti } from '../../shared/confetti';
import { Loader } from '../../shared/loader';
import { Sheet } from '../../shared/sheet';
import { dailyDifficulty, gameInfo, isPuzzleGame, mapLink, PuzzleGameId, trackOf } from '../catalog';
import { QueensBoard } from '../queens/queens-board';
import { SudokuBoard } from '../sudoku/sudoku-board';
import { ZipBoard } from '../zip/zip-board';
import { TangoBoard } from '../tango/tango-board';
import { ADAPTERS } from './adapters';
import { LEVEL_COUNT, PracticeStore } from './practice.store';
import { parMs, starsFor } from './par';
import { shareCard } from './share';
import { PuzzleAttempt, PuzzleDailyService, PuzzleDailyState } from './puzzle-daily.service';

type Phase = 'loading' | 'signin' | 'offline' | 'unavailable' | 'ready' | 'playing' | 'blocked' | 'finished' | 'practice';

/** One screen for every grid puzzle, in practice (endless levels, offline) or daily (one attempt, timed by the server) mode. */
/** How long the board sits still before a mistake is pointed out. */
const WARN_DELAY_MS = 1600;

@Component({
  selector: 'app-puzzle-page',
  imports: [NgTemplateOutlet, RouterLink, Confetti, Loader, Sheet, QueensBoard, TangoBoard, SudokuBoard, ZipBoard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page" [attr.data-game]="game()">
      <header class="bar">
        <a routerLink="/" class="back" aria-label="Back to games">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        </a>
        <div class="title">
          <h1>{{ info()?.name }}</h1>
          <p class="muted sub">{{ subtitle() }}</p>
        </div>
        <a class="back" [routerLink]="['/ranks']" [queryParams]="{ game: game(), kind: daily() ? 'daily' : 'practice' }" aria-label="Leaderboard">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 20V11M12 20V4M17 20v-6" /></svg>
        </a>
      </header>

      @switch (phase()) {
        @case ('loading') {
          <div class="skeleton board-skeleton" aria-busy="true"></div>
          <p class="muted center"><app-loader [size]="16" /> Loading</p>
        }
        @case ('playing') {
          <ng-container [ngTemplateOutlet]="playing" />
        }
        @case ('practice') {
          <ng-container [ngTemplateOutlet]="playing" />
        }
        @case ('finished') {
          <section class="card panel">
            <h2>Solved{{ attempt()?.rank ? ' · rank #' + attempt()!.rank : '' }}</h2>
            <p class="muted">Your time was {{ attempt()?.elapsedMs ? fmt(attempt()!.elapsedMs!) : '' }}. The next puzzle arrives in {{ untilNext() }}.</p>
            <div class="actions">
              <a class="button" [routerLink]="['/ranks']" [queryParams]="{ game: game(), kind: 'daily' }">See leaderboard</a>
              <button type="button" class="secondary" (click)="share()">{{ copied() ? 'Copied' : 'Share' }}</button>
              <a class="button secondary" [routerLink]="['/games', game()]">Practice</a>
            </div>
          </section>
        }
        @default {
          <section class="card panel">
            <h2>{{ panel().title }}</h2>
            <p class="muted">{{ panel().text }}</p>
            <div class="actions">
              @switch (phase()) {
                @case ('signin') {
                  <a class="button" routerLink="/account">Sign in</a>
                }
                @case ('ready') {
                  <button type="button" [disabled]="busy()" (click)="startDaily()">
                    @if (busy()) {
                      <app-loader [size]="16" />
                    }
                    Start today's puzzle
                  </button>
                }
                @default {
                  <button type="button" (click)="loadDaily()">Try again</button>
                }
              }
              <a class="button secondary" [routerLink]="['/games', game()]">Play practice</a>
            </div>
          </section>
        }
      }
    </div>

    <ng-template #playing>
      @if (puzzle(); as p) {
        <div class="layout">
          <div class="status" role="status" aria-live="polite">
            <div class="clock">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="7.5" /><path d="M12 9v4l2.5 1.5M9.5 3h5" /></svg>
              <span class="time" aria-label="Time">{{ time() }}</span>
            </div>
            <span class="pill">{{ daily() ? 'Daily' + (difficulty() ? ' · ' + difficulty()!.label : '') : 'Level ' + level() }}</span>
            @if (message()) {
              <span class="toast">{{ message() }}</span>
            }
          </div>

          <div class="stage">
            @switch (game()) {
              @case ('queens') {
                <app-queens-board [puzzle]="$any(p)" [board]="$any(state())" [bad]="conflicts()" [locked]="locked()" [solved]="solved()" (boardChange)="change($event)" />
              }
              @case ('tango') {
                <app-tango-board [puzzle]="$any(p)" [board]="$any(state())" [bad]="conflicts()" [locked]="locked()" [solved]="solved()" (boardChange)="change($event)" />
              }
              @case ('zip') {
                <app-zip-board [puzzle]="$any(p)" [board]="$any(state())" [bad]="conflicts()" [locked]="locked()" [solved]="solved()" (boardChange)="change($event)" />
              }
              @case ('sudoku') {
                <app-sudoku-board [puzzle]="$any(p)" [board]="$any(state())" [bad]="conflicts()" [locked]="locked()" [solved]="solved()" (boardChange)="change($event)" />
              }
            }
          </div>

          <div class="tools" role="toolbar" aria-label="Tools">
            <button type="button" class="tool" [disabled]="!history().length || locked()" (click)="undo()">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" /></svg>
              <span>Undo</span>
            </button>
            <button type="button" class="tool" [disabled]="!touched() || locked()" (click)="clear()">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v5h5" /></svg>
              <span>Reset</span>
            </button>
            @if (!daily()) {
              <a class="tool" [routerLink]="mapLink()">
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></svg>
                <span>Map</span>
              </a>
            }
            <button type="button" class="tool" (click)="helpOpen.set(true)">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M9.7 9.5a2.4 2.4 0 1 1 3.4 2.2c-.7.4-1.1.8-1.1 1.6M12 16.8v.1" /></svg>
              <span>Rules</span>
            </button>
          </div>
        </div>
      }
    </ng-template>

    @if (resultOpen()) {
      <app-confetti />
    }

    @if (helpOpen()) {
      <app-sheet label="How to play" (closed)="helpOpen.set(false)">
        <h2>How to play</h2>
        <p>{{ help() }}</p>
        <button type="button" (click)="helpOpen.set(false)">Got it</button>
      </app-sheet>
    }

    @if (resultOpen()) {
      <app-sheet label="Solved" (closed)="resultOpen.set(false)">
        <div class="result">
          <div class="burst" aria-hidden="true">✓</div>
          <h2>Solved in {{ fmt(finalMs()) }}</h2>
          @if (daily()) {
            @if (attempt()?.rank) {
              <p class="muted">You are #{{ attempt()!.rank }} so far today.</p>
            }
            <div class="actions">
              <a class="button" [routerLink]="['/ranks']" [queryParams]="{ game: game(), kind: 'daily' }" (click)="resultOpen.set(false)">Leaderboard</a>
              <button type="button" class="secondary" (click)="share()">{{ copied() ? 'Copied' : 'Share' }}</button>
            </div>
          } @else {
            <div class="stars" role="img" [attr.aria-label]="stars() + ' of 3 stars'">
              @for (n of [1, 2, 3]; track n) {
                <svg viewBox="0 0 24 24" [class.on]="n <= stars()" [style.--i]="n"><path d="M12 2.8l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.6l-5.8 3.1 1.1-6.5L2.6 9.6l6.5-.9z" /></svg>
              }
            </div>
            @if (bestMs() !== null && bestMs()! < finalMs()) {
              <p class="muted">Your best on this level is {{ fmt(bestMs()!) }}.</p>
            }
            <div class="actions">
              <button type="button" (click)="nextLevel()">Next level</button>
              <a class="button secondary" [routerLink]="mapLink()" (click)="resultOpen.set(false)">Map</a>
              <button type="button" class="secondary" (click)="share()">{{ copied() ? 'Copied' : 'Share' }}</button>
              <button type="button" class="secondary" (click)="openLevel(level())">Replay</button>
            </div>
          }
        </div>
      </app-sheet>
    }
  `,
  styleUrl: './puzzle-page.scss',
})
export class PuzzlePage {
  private readonly route = inject(ActivatedRoute);
  private readonly haptics = inject(HapticsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);
  private readonly sync = inject(SyncService);
  private readonly store = inject(LocalStore);
  private readonly practiceStore = inject(PracticeStore);
  private readonly dailyApi = inject(PuzzleDailyService);

  private readonly params = toSignal(this.route.paramMap);
  private readonly data = toSignal(this.route.data);

  protected readonly game = computed<PuzzleGameId>(() => {
    const id = this.params()?.get('game') ?? '';
    return isPuzzleGame(id) ? id : 'queens';
  });
  /** Sudoku and any other game with variants: classic, mini... (practice only; the daily has one kind). */
  protected readonly variant = computed(() => (this.daily() ? null : this.params()?.get('variant') ?? null));
  /** What practice progress and levels are stored under. */
  private readonly track = computed(() => trackOf(this.game(), this.variant()));
  protected readonly mapLink = computed(() => mapLink(this.game(), this.variant()));
  protected readonly daily = computed(() => this.data()?.['mode'] === 'daily');
  protected readonly info = computed(() => gameInfo(this.game()));
  protected readonly help = computed(() => ADAPTERS[this.game()].help);

  protected readonly phase = signal<Phase>('loading');
  protected readonly puzzle = signal<unknown>(null);
  protected readonly state = signal<unknown>(null);
  protected readonly history = signal<unknown[]>([]);
  protected readonly level = signal(1);
  protected readonly attempt = signal<PuzzleAttempt | null>(null);
  protected readonly nextRollover = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly message = signal('');
  protected readonly helpOpen = signal(false);
  protected readonly resultOpen = signal(false);
  protected readonly copied = signal(false);
  protected readonly solved = signal(false);
  protected readonly finalMs = signal(0);
  protected readonly dateLabel = signal('');

  private readonly now = signal(Date.now());
  /** Practice clock: time played before the page was opened, and when this stretch began. */
  private baseMs = 0;
  private stretchStart = Date.now();
  /** Daily clock: when the server started the attempt. */
  private serverStart = 0;
  private readonly checking = signal(false);

  /** Rule breaks, calculated at once but only shown once the player pauses (so a move in progress is never flagged). */
  private readonly found = computed(() => {
    const p = this.puzzle();
    const s = this.state();
    return p && s ? ADAPTERS[this.game()].conflicts(p, s) : new Set<number>();
  });
  protected readonly conflicts = signal<Set<number>>(new Set());
  protected readonly touched = computed(() => {
    const p = this.puzzle();
    const s = this.state();
    return p && s ? ADAPTERS[this.game()].touched(p, s) : false;
  });
  protected readonly locked = computed(() => this.solved() || this.checking());
  protected readonly elapsed = computed(() => {
    const now = this.now();
    return this.daily() ? Math.max(0, now - this.serverStart) : this.baseMs + (now - this.stretchStart);
  });
  protected readonly time = computed(() => (this.solved() ? this.fmt(this.finalMs()) : this.fmt(this.elapsed())));
  protected readonly stars = computed(() => {
    const p = this.puzzle();
    return p ? starsFor(this.finalMs(), parMs(this.game(), p)) : 0;
  });
  protected readonly bestMs = computed(() => this.practiceStore.bestMs(this.track(), this.level()));

  protected readonly difficulty = computed(() => dailyDifficulty(this.dateLabel()));
  protected readonly subtitle = computed(() => (this.daily() ? `Daily · ${this.dateLabel() || 'today'}` : `Practice · Level ${this.level()}`));
  protected readonly untilNext = computed(() => {
    const target = this.nextRollover();
    if (!target) return 'a while';
    const minutes = Math.max(0, Math.ceil((Date.parse(target) - this.now()) / 60000));
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  });

  protected readonly panel = computed(() => {
    switch (this.phase()) {
      case 'signin':
        return { title: 'Sign in to play the daily', text: 'Everyone gets the same puzzle each day and your time goes on the leaderboard.' };
      case 'offline':
        return { title: 'The daily needs a connection', text: 'Check your internet and try again. Practice works offline.' };
      case 'unavailable':
        return { title: "Today's puzzle is not ready", text: 'Try again in a little while.' };
      case 'ready':
        return { title: "Today's puzzle", text: 'One attempt per day. Your clock starts when you tap start.' };
      default:
        return { title: 'Playing on another device', text: "Today's puzzle is open on another device. If it goes idle for a couple of minutes you can continue here." };
    }
  });

  private heartbeat?: ReturnType<typeof setInterval>;
  private saveTimer?: ReturnType<typeof setTimeout>;
  private showTimer?: ReturnType<typeof setTimeout>;
  private wrongTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    const tick = setInterval(() => this.now.set(Date.now()), 500);
    this.destroyRef.onDestroy(() => {
      clearInterval(tick);
      clearInterval(this.heartbeat);
      void this.persist();
    });
    // (Re)load whenever the route (game or mode) changes.
    effect(() => {
      const game = this.game();
      const daily = this.daily();
      this.variant();
      queueMicrotask(() => void (daily ? this.loadDaily() : this.loadPractice(game)));
    });
    effect(() => {
      const found = this.found();
      untracked(() => {
        clearTimeout(this.showTimer);
        this.conflicts.set(new Set());
        if (found.size) {
          this.showTimer = setTimeout(() => {
            this.conflicts.set(found);
            this.haptics.warning();
          }, WARN_DELAY_MS);
        }
      });
    });
    // Pause the practice clock while the page is hidden.
    const onVisibility = () => {
      if (this.daily() || this.solved()) return;
      if (document.hidden) {
        this.baseMs += Date.now() - this.stretchStart;
        void this.persist();
      } else this.stretchStart = Date.now();
    };
    document.addEventListener('visibilitychange', onVisibility);
    this.destroyRef.onDestroy(() => document.removeEventListener('visibilitychange', onVisibility));
  }

  protected fmt(ms: number): string {
    return formatDuration(ms);
  }

  // ---------------------------------------------------------------------------------------------- practice

  private async loadPractice(game: PuzzleGameId): Promise<void> {
    clearInterval(this.heartbeat);
    this.phase.set('loading');
    this.solved.set(false);
    this.resultOpen.set(false);
    const track = this.track();
    await this.practiceStore.load(track);
    const saved = await this.practiceStore.loadBoard(track);
    const asked = Number(this.route.snapshot.queryParamMap.get('level'));
    const frontier = this.practiceStore.frontier(track);
    // A level asked for on the map, else the one in progress, else the next one to play. Levels not unlocked yet stay closed.
    const level = asked >= 1 && asked <= frontier ? asked : saved && saved.level <= frontier ? saved.level : frontier;
    await this.openLevel(level, saved?.level === level ? saved : undefined);
  }

  protected async openLevel(level: number, saved?: { state: unknown; elapsedMs: number }): Promise<void> {
    const game = this.game();
    if (!this.practiceStore.isUnlocked(this.track(), level)) return;
    const levels = await ADAPTERS[game].levels(this.variant());
    const puzzle = levels[level - 1];
    if (!puzzle) return;
    this.resultOpen.set(false);
    this.solved.set(false);
    this.level.set(level);
    this.puzzle.set(puzzle);
    const fresh = ADAPTERS[game].blank(puzzle);
    const adapter = ADAPTERS[game];
    const keep = saved && (adapter.fits ? adapter.fits(puzzle, saved.state) : fitsPuzzle(fresh, saved.state));
    this.state.set(keep ? saved.state : fresh);
    this.history.set([]);
    this.baseMs = keep ? saved.elapsedMs : 0;
    this.stretchStart = Date.now();
    this.phase.set('practice');
    await this.persist();
  }

  protected nextLevel(): void {
    void this.openLevel(Math.min(LEVEL_COUNT, this.level() + 1));
  }

  // ---------------------------------------------------------------------------------------------- daily

  private dailyKey(): string {
    return `puzzle.daily.${this.game()}.${this.dateLabel()}`;
  }

  protected async loadDaily(): Promise<void> {
    clearInterval(this.heartbeat);
    this.solved.set(false);
    this.resultOpen.set(false);
    if (!this.auth.signedIn()) return void this.phase.set('signin');
    if (!this.sync.online()) return void this.phase.set('offline');
    this.phase.set('loading');
    try {
      this.applyDaily(await this.dailyApi.state(this.game()));
    } catch (error) {
      this.phase.set((error as { status?: number }).status === 404 ? 'unavailable' : 'offline');
    }
  }

  protected async startDaily(): Promise<void> {
    this.busy.set(true);
    try {
      this.applyDaily(await this.dailyApi.start(this.game()));
    } catch {
      this.phase.set('offline');
    } finally {
      this.busy.set(false);
    }
  }

  private applyDaily(state: PuzzleDailyState): void {
    this.dateLabel.set(state.date);
    this.nextRollover.set(state.nextRolloverUtc);
    const attempt = state.attempt;
    this.attempt.set(attempt);
    if (!attempt) return void this.phase.set('ready');
    if (attempt.status === 'solved') return void this.phase.set('finished');
    if (!attempt.activeOnThisDevice || !attempt.puzzle) return void this.phase.set('blocked');
    this.serverStart = Date.parse(attempt.startedAt);
    this.puzzle.set(attempt.puzzle);
    this.history.set([]);
    void this.store.getMeta<{ state: unknown }>(this.dailyKey()).then((saved) => {
      this.state.set(saved?.state ?? ADAPTERS[this.game()].blank(attempt.puzzle));
      this.phase.set('playing');
    });
    clearInterval(this.heartbeat);
    this.heartbeat = setInterval(() => void this.dailyApi.heartbeat(this.game()), 45_000);
  }

  // ---------------------------------------------------------------------------------------------- playing

  protected change(next: unknown): void {
    if (this.locked()) return;
    clearTimeout(this.wrongTimer);
    this.history.update((h) => [...h.slice(-99), this.state()]);
    this.state.set(next);
    this.scheduleSave();
    void this.checkSolved();
  }

  protected undo(): void {
    clearTimeout(this.wrongTimer);
    const h = this.history();
    if (!h.length) return;
    this.state.set(h[h.length - 1]);
    this.history.set(h.slice(0, -1));
    this.scheduleSave();
  }

  protected clear(): void {
    clearTimeout(this.wrongTimer);
    const p = this.puzzle();
    if (!p) return;
    this.history.update((h) => [...h.slice(-99), this.state()]);
    this.state.set(ADAPTERS[this.game()].blank(p));
    this.scheduleSave();
  }

  private scheduleSave(): void {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.persist(), 400);
  }

  private async persist(): Promise<void> {
    const game = this.game();
    const state = this.state();
    if (!state || this.solved()) return;
    if (this.daily()) {
      if (this.phase() === 'playing') await this.store.setMeta(this.dailyKey(), { state });
    } else if (this.phase() === 'practice') {
      const elapsedMs = this.baseMs + (Date.now() - this.stretchStart);
      await this.practiceStore.saveBoard(this.track(), { level: this.level(), state, elapsedMs });
    }
  }

  private async checkSolved(): Promise<void> {
    const p = this.puzzle();
    const s = this.state();
    const game = this.game();
    if (!p || !s) return;
    const solution = ADAPTERS[game].solution(p, s);
    if (!ADAPTERS[game].isSolved(p, s)) {
      // A full board that is wrong: say so, but only once the player pauses (any further move cancels the warning).
      if (solution !== null) {
        const found = this.found();
        clearTimeout(this.wrongTimer);
        this.wrongTimer = setTimeout(() => {
          this.flash('Not quite. Check the highlighted cells.');
          if (!found.size) this.haptics.warning(); // otherwise the highlight (which has its own delay) vibrates
        }, WARN_DELAY_MS);
      }
      return;
    }

    if (this.daily()) {
      this.checking.set(true);
      const result = await this.dailyApi.submit(game, solution);
      this.checking.set(false);
      if (result.ok) {
        clearInterval(this.heartbeat);
        this.attempt.set(result.state.attempt);
        this.finalMs.set(result.state.attempt?.elapsedMs ?? this.elapsed());
        this.solved.set(true);
        this.haptics.success();
        void this.store.deleteMeta(this.dailyKey());
        setTimeout(() => this.resultOpen.set(true), 900);
      } else {
        this.flash(
          result.error === 'too-fast'
            ? 'That was suspiciously fast. Try again.'
            : result.error === 'not-active-device'
              ? 'Playing on another device now.'
              : result.error === 'incorrect'
                ? 'Not quite right.'
                : 'Could not reach the server. Try again.',
        );
        if (result.error === 'not-active-device') void this.loadDaily();
      }
      return;
    }

    const elapsedMs = this.baseMs + (Date.now() - this.stretchStart);
    this.finalMs.set(elapsedMs);
    this.solved.set(true);
    this.haptics.success();
    const level = this.level();
    await this.practiceStore.markSolved(this.track(), level, elapsedMs);
    await this.practiceStore.clearBoard(this.track());
    await this.sync.record('puzzle.practice.solved', { game, variant: this.variant() ?? undefined, level, solution, elapsedMs });
    setTimeout(() => this.resultOpen.set(true), 900);
  }

  private flash(text: string): void {
    this.message.set(text);
    setTimeout(() => this.message.set(''), 2400);
  }

  protected async share(): Promise<void> {
    const game = this.game();
    const text = shareCard({
      game,
      name: this.info()?.name ?? 'Zenigma',
      label: this.daily() ? `Daily ${this.dateLabel()}` : `Level ${this.level()}`,
      puzzle: this.puzzle(),
      state: this.state(),
      ms: this.finalMs() || this.attempt()?.elapsedMs || 0,
      rank: this.daily() ? this.attempt()?.rank : null,
    });
    try {
      if (navigator.share) await navigator.share({ text });
      else await navigator.clipboard.writeText(text);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1800);
    } catch {
      /* cancelled */
    }
  }
}

/** A board saved earlier is only reused when it still has this puzzle's shape and keeps its fixed cells (older app versions saved other shapes). */
export function fitsPuzzle(fresh: unknown, saved: unknown): boolean {
  if (!Array.isArray(fresh) || !Array.isArray(saved) || fresh.length !== saved.length) return false;
  return fresh.every((cell, i) => {
    const empty = cell === 0 || cell === '.';
    return typeof saved[i] === typeof cell && (empty || saved[i] === cell);
  });
}
