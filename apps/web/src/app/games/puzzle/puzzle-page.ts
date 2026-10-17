import { featuredFor } from '../../features/challenges/featured';
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, ElementRef, HostListener, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PrefsService } from '../../core/prefs.service';
import { HintsSyncService } from '../../core/hints-sync.service';
import { WidgetService } from '../../core/widget.service';
import { HapticsService } from '../../core/haptics.service';
import { BackService } from '../../core/back.service';
import { AuthService } from '../../core/auth.service';
import { formatDuration } from '../../core/leaderboard.service';
import { LocalStore } from '../../core/local-store';
import { SyncService } from '../../core/sync.service';
import { Confetti } from '../../shared/confetti';
import { Loader } from '../../shared/loader';
import { LeaveSheet } from '../../shared/leave-sheet';
import { CanLeave } from '../../core/leave';
import { Sheet } from '../../shared/sheet';
import { HintWheel } from '../../shared/hint-wheel';
import { ShareSheet } from '../../shared/share-sheet';
import { CardInput, gridFromText } from '../../shared/share-card';
import { HintsService } from '../../core/hints.service';
import { ScreenGuardService } from '../../core/screen-guard.service';
import { Hint, hasMistake, hintFor } from '../hints/hint';
import { dailyDifficulty, gameInfo, levelCountOf, isPuzzleGame, mapLink, playLink, PuzzleGameId, trackOf } from '../catalog';
import { QueensBoard } from '../queens/queens-board';
import { SudokuBoard } from '../sudoku/sudoku-board';
import { ZipBoard } from '../zip/zip-board';
import { PatchesBoard } from '../patches/patches-board';
import { TangoBoard } from '../tango/tango-board';
import { ADAPTERS } from './adapters';
import { levelAt } from './level-source';
import { RULES_BY_ID } from '../../features/rules/rules-data';
import { PracticeStore } from './practice.store';
import { parMs, starsFor } from './par';
import { shareCard } from './share';
import { PuzzleAttempt, PuzzleDailyService, PuzzleDailyState } from './puzzle-daily.service';

type Phase = 'loading' | 'signin' | 'offline' | 'unavailable' | 'ready' | 'playing' | 'blocked' | 'finished' | 'practice';

/** One screen for every grid puzzle, in practice (endless levels, offline) or daily (one attempt, timed by the server) mode. */
/** How long the board sits still before a mistake is pointed out. */
const WARN_DELAY_MS = 1600;
/** Queens and Tango flag a break more slowly: a player who is still mid-thought usually fixes it before the warning lands. */
const SLOW_WARN_DELAY_MS = 3000;

@Component({
  selector: 'app-puzzle-page',
  imports: [NgTemplateOutlet, RouterLink, Confetti, Loader, Sheet, HintWheel, ShareSheet, LeaveSheet, QueensBoard, TangoBoard, SudokuBoard, ZipBoard, PatchesBoard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './puzzle-page.html',
  styleUrl: './puzzle-page.scss',
})
export class PuzzlePage {
  private readonly route = inject(ActivatedRoute);
  protected readonly nav = inject(BackService);
  private readonly widgetSvc = inject(WidgetService);
  private readonly hintsSync = inject(HintsSyncService);
  private readonly haptics = inject(HapticsService);
  protected readonly prefs = inject(PrefsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);
  private readonly sync = inject(SyncService);
  private readonly store = inject(LocalStore);
  private readonly practiceStore = inject(PracticeStore);
  private readonly dailyApi = inject(PuzzleDailyService);
  protected readonly hints = inject(HintsService);
  private readonly guard = inject(ScreenGuardService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

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
  /** Boards undone, newest first, for Redo. A new move clears them. */
  protected readonly future = signal<unknown[]>([]);
  protected readonly level = signal(1);
  protected readonly attempt = signal<PuzzleAttempt | null>(null);
  protected readonly nextRollover = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly message = signal('');
  protected readonly helpOpen = signal(false);
  /** The share of today's finishers this player was faster than (hidden until at least two people have finished). */
  protected readonly percentile = computed(() => {
    const a = this.attempt();
    if (!a?.rank || !a.finishers || a.finishers < 2) return null;
    return Math.round(((a.finishers - a.rank) / a.finishers) * 100);
  });
  /** A friend's time on a level (from a challenge link) to beat. */
  protected readonly challenge = signal<{ level: number; ms: number } | null>(null);
  protected readonly challengeNow = computed(() => {
    const c = this.challenge();
    return c && c.level === this.level() && !this.daily() ? c : null;
  });
  protected readonly rules = computed(() => RULES_BY_ID.get(this.game()));
  protected readonly wheelOpen = signal(false);
  /** Practice only: the board is covered and the clock stops. */
  protected readonly paused = signal(false);
  /** Strict practice: wrong moves left before the board resets. */
  protected readonly strikesLeft = signal(3);
  protected readonly strict = computed(() => this.prefs.strikes() && !this.daily());
  private wasWrong = false;
  /** Moves that made the board impossible to finish, this level (counted for the featured level's weekly board). */
  private mistakes = 0;
  /** Set while "Leave this game?" is open; calling it with the answer lets the navigation go or stops it. */
  protected readonly leaving = signal<((ok: boolean) => void) | null>(null);
  protected readonly shareOpen = signal<{ card: CardInput; text: string } | null>(null);
  protected readonly coach = signal<Hint | null>(null);
  /** The first level of a game, the first time: every move is followed by a free hint for the next step. */
  protected readonly tutorial = signal(false);
  /** Hints spent on the level in play (a level solved with help earns at most two stars). */
  private readonly hintsUsed = signal(0);
  private glowTimer?: ReturnType<typeof setTimeout>;
  protected readonly resultOpen = signal(false);
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
    if (this.daily()) return Math.max(0, now - this.serverStart);
    return this.paused() ? this.baseMs : this.baseMs + (now - this.stretchStart);
  });
  protected readonly time = computed(() => (this.solved() ? this.fmt(this.finalMs()) : this.fmt(this.elapsed())));
  protected readonly stars = computed(() => {
    const p = this.puzzle();
    return p ? (Math.min(this.hintsUsed() > 0 ? 2 : 3, starsFor(this.finalMs(), parMs(this.game(), p))) as 0 | 1 | 2 | 3) : 0;
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
          }, this.warnDelay());
        }
      });
    });
    // Keep the screen on while a puzzle is open; the daily also blocks screenshots (Android).
    effect(() => {
      const open = this.phase() === 'playing' || this.phase() === 'practice';
      const secure = this.daily();
      untracked(() => (open ? this.guard.enter(secure) : this.guard.leave()));
    });
    this.destroyRef.onDestroy(() => this.guard.leave());
    // Pause the practice clock while the page is hidden.
    const onVisibility = () => {
      if (this.daily() || this.solved()) return;
      if (this.paused()) return;
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

  /** The level opened from the featured card this visit (it may be beyond the unlocked levels). */
  private featuredLevel = 0;

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
    // A challenge link (?level=N&vs=ms) opens its level even when it is not unlocked yet.
    const vs = Number(this.route.snapshot.queryParamMap.get('vs'));
    this.challenge.set(asked >= 1 && vs > 0 ? { level: asked, ms: vs } : null);
    // The featured level of the week (?featured=1) also opens out of turn.
    const featured = this.route.snapshot.queryParamMap.get('featured') === '1';
    this.featuredLevel = featured && asked >= 1 ? asked : 0;
    const level = asked >= 1 && (asked <= frontier || this.challenge() || featured) ? asked : saved && saved.level <= frontier ? saved.level : frontier;
    await this.openLevel(level, saved?.level === level ? saved : undefined);
  }

  /** The first time someone opens one of a game's first levels, show how to play (once per game, on this device). */
  private firstTimeHelp(level: number): void {
    if (this.daily() || level > 3) return;
    const key = `zenigma.tutorial.${this.game()}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, '1');
    } catch {
      return;
    }
    this.helpOpen.set(true);
  }

  /** The rules of this game, shown beside the board on a very wide screen. */
  protected readonly gameRules = computed(() => RULES_BY_ID.get(this.game()) ?? null);

  protected async openLevel(level: number, saved?: { state: unknown; elapsedMs: number }): Promise<void> {
    const game = this.game();
    if (!this.practiceStore.isUnlocked(this.track(), level) && this.challenge()?.level !== level && this.featuredLevel !== level) return;
    const puzzle = await levelAt(this.track(), level).catch(() => null);
    if (!puzzle) return;
    this.resultOpen.set(false);
    this.solved.set(false);
    this.level.set(level);
    this.firstTimeHelp(level);
    this.puzzle.set(puzzle);
    const fresh = ADAPTERS[game].blank(puzzle);
    const adapter = ADAPTERS[game];
    this.dismissCoach();
    this.paused.set(false);
    const keep = saved && (adapter.fits ? adapter.fits(puzzle, saved.state) : fitsPuzzle(fresh, saved.state));
    this.hintsUsed.set(keep ? (saved as { hints?: number }).hints ?? 0 : 0);
    this.state.set(keep ? saved.state : fresh);
    this.history.set([]);
    this.future.set([]);
    this.strikesLeft.set(3);
    this.wasWrong = false;
    this.mistakes = 0;
    this.baseMs = keep ? saved.elapsedMs : 0;
    this.stretchStart = Date.now();
    this.phase.set('practice');
    this.startTutorial(level);
    await this.persist();
  }

  private tutorialKey(): string {
    return `zenigma.tutorial.done.${this.game()}`;
  }

  /** Tutorial mode: level 1 of a game that has not been learnt yet, outside challenges and dailies. */
  private startTutorial(level: number): void {
    this.tutorial.set(false);
    if (this.daily() || level !== 1 || this.challenge() || this.featuredLevel === level) return;
    try {
      if (localStorage.getItem(this.tutorialKey())) return;
    } catch {
      return;
    }
    this.tutorial.set(true);
    setTimeout(() => this.tutorialStep(), 700);
  }

  /** Shows the next step as a free coach card (no hint is spent and the level still counts as clean). */
  private tutorialStep(): void {
    const p = this.puzzle();
    const s = this.state();
    if (!this.tutorial() || !p || !s || this.solved()) return;
    const hint = hintFor(this.game(), p, s);
    if (hint.kind === 'done' || hint.kind === 'none') {
      this.dismissCoach();
      return;
    }
    this.coach.set(hint);
    this.glow(hint);
  }

  protected endTutorial(): void {
    this.tutorial.set(false);
    this.dismissCoach();
    try {
      localStorage.setItem(this.tutorialKey(), '1');
    } catch {
      /* ignore */
    }
  }

  /** Offered after three quick, clean wins in a row. */
  protected readonly canSkip = computed(() => this.solved() && !this.daily() && this.practiceStore.quickWins(this.track()) >= 3 && this.level() < levelCountOf(this.track()) - 5);

  protected async skipAhead(): Promise<void> {
    await this.practiceStore.skipAhead(this.track(), 5);
    void this.openLevel(this.practiceStore.frontier(this.track()));
  }

  protected nextLevel(): void {
    void this.openLevel(Math.min(levelCountOf(this.track()), this.level() + 1));
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
      // No "start" button: today's puzzle opens as soon as the screen does.
      if (this.phase() === 'ready') void this.startDaily();
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
    this.hintsUsed.set(attempt.hints ?? 0);
    this.puzzle.set(attempt.puzzle);
    this.history.set([]);
    this.future.set([]);
    void this.store.getMeta<{ state: unknown; hints?: number }>(this.dailyKey()).then((saved) => {
      this.hintsUsed.set(Math.max(attempt.hints ?? 0, saved?.hints ?? 0));
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
    this.clearGlow();
    this.history.update((h) => [...h.slice(-99), this.state()]);
    this.future.set([]);
    this.state.set(next);
    this.scheduleSave();
    this.strike();
    this.tutorialStep();
    void this.checkSolved();
  }

  /** In strict practice, a move that makes the board impossible to finish costs a strike; the third resets the board. */
  private strike(): void {
    const p = this.puzzle();
    const featured = this.featuredLevel > 0 && this.featuredLevel === this.level();
    if (!p || (!this.strict() && !featured)) return;
    const wrong = hasMistake(this.game(), p, this.state());
    if (wrong && !this.wasWrong) this.mistakes++;
    if (!this.strict()) {
      this.wasWrong = wrong;
      return;
    }
    if (wrong && !this.wasWrong) {
      this.strikesLeft.update((n) => n - 1);
      this.haptics.error();
      if (this.strikesLeft() <= 0) {
        this.flash('Three strikes. The board was reset.');
        this.strikesLeft.set(3);
        this.history.set([]);
        this.future.set([]);
        this.state.set(ADAPTERS[this.game()].blank(p));
        this.wasWrong = false;
        return;
      }
      this.flash(`Not quite. ${this.strikesLeft()} ${this.strikesLeft() === 1 ? 'strike' : 'strikes'} left.`);
    }
    this.wasWrong = wrong;
  }

  protected undo(): void {
    clearTimeout(this.wrongTimer);
    const h = this.history();
    if (!h.length) return;
    this.haptics.tick();
    this.future.update((f) => [this.state(), ...f]);
    this.state.set(h[h.length - 1]);
    this.history.set(h.slice(0, -1));
    this.scheduleSave();
  }

  protected redo(): void {
    clearTimeout(this.wrongTimer);
    const f = this.future();
    if (!f.length || this.locked()) return;
    this.haptics.tick();
    this.history.update((h) => [...h.slice(-99), this.state()]);
    this.state.set(f[0]);
    this.future.set(f.slice(1));
    this.scheduleSave();
    void this.checkSolved();
  }

  /** Keyboard: Ctrl or Cmd + Z undoes, Ctrl or Cmd + Shift + Z (or Y) redoes. */
  @HostListener('window:keydown', ['$event'])
  protected onKey(e: KeyboardEvent): void {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const target = e.target as HTMLElement | null;
    if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) this.undo();
    else if ((k === 'z' && e.shiftKey) || k === 'y') this.redo();
    else return;
    e.preventDefault();
  }

  protected clear(): void {
    clearTimeout(this.wrongTimer);
    const p = this.puzzle();
    if (!p) return;
    this.haptics.place();
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
      if (this.phase() === 'playing') await this.store.setMeta(this.dailyKey(), { state, hints: this.hintsUsed() });
    } else if (this.phase() === 'practice') {
      const elapsedMs = this.paused() ? this.baseMs : this.baseMs + (Date.now() - this.stretchStart);
      await this.practiceStore.saveBoard(this.track(), { level: this.level(), state, elapsedMs, hints: this.hintsUsed() });
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
        }, this.warnDelay());
      }
      return;
    }

    if (this.daily()) {
      this.checking.set(true);
      // Hint spends reach the server first, so the pool is debited together with the result; hints used offline are reported now.
      await this.hintsSync.sync();
      const result = await this.dailyApi.submit(game, solution, this.hintsUsed());
      this.checking.set(false);
      if (result.ok) {
        clearInterval(this.heartbeat);
        this.attempt.set(result.state.attempt);
        this.finalMs.set(result.state.attempt?.elapsedMs ?? this.elapsed());
        this.solved.set(true);
        this.haptics.success();
        void this.store.deleteMeta(this.dailyKey());
        setTimeout(() => void this.widgetSvc.refresh(), 1500);
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

    const elapsedMs = this.paused() ? this.baseMs : this.baseMs + (Date.now() - this.stretchStart);
    this.finalMs.set(elapsedMs);
    this.solved.set(true);
    this.haptics.success();
    const level = this.level();
    if (this.tutorial()) this.endTutorial();
    await this.practiceStore.markSolved(this.track(), level, elapsedMs, this.hintsUsed() > 0);
    await this.practiceStore.noteWin(this.track(), this.stars(), this.hintsUsed() > 0);
    this.dismissCoach();
    this.reward(level);
    await this.practiceStore.clearBoard(this.track());
    await this.sync.record('puzzle.practice.solved', {
      game,
      variant: this.variant() ?? undefined,
      level,
      solution,
      elapsedMs,
      hinted: this.hintsUsed() > 0,
      ...(this.featuredLevel === level ? { featured: featuredFor(new Date()).week, mistakes: this.mistakes } : {}),
    });
    setTimeout(() => this.resultOpen.set(true), 900);
  }

  private warnDelay(): number {
    const g = this.game();
    return g === 'queens' || g === 'tango' ? SLOW_WARN_DELAY_MS : WARN_DELAY_MS;
  }

  private flash(text: string): void {
    this.message.set(text);
    setTimeout(() => this.message.set(''), 2400);
  }

  /** Stops the clock and covers the board (practice only: a daily is timed by the server). */
  protected togglePause(): void {
    if (this.daily() || this.locked()) return;
    this.haptics.tick();
    if (this.paused()) {
      this.stretchStart = Date.now();
      this.paused.set(false);
    } else {
      this.baseMs += Date.now() - this.stretchStart;
      this.paused.set(true);
      void this.persist();
    }
  }

  /** A stray Back press, swipe or tap on a board that has been played on asks first. A practice clock stops while the question is open. */
  canLeave(): boolean | Promise<boolean> {
    if (this.solved() || this.locked() || this.history().length === 0) return true;
    if (!this.daily() && !this.paused()) this.togglePause();
    this.haptics.warning();
    return new Promise<boolean>((resolve) => this.leaving.set(resolve));
  }

  protected answerLeave(leave: boolean): void {
    const done = this.leaving();
    this.leaving.set(null);
    if (!leave && !this.daily() && this.paused()) this.togglePause();
    done?.(leave);
  }

  // ---------------------------------------------------------------------------------------------- hints

  /** Spends a hint and coaches: points at a mistake, or at where to look next. Never fills a cell. */
  protected async useHint(): Promise<void> {
    const p = this.puzzle();
    const s = this.state();
    if (this.locked() || !p || !s) return;
    if (!this.hints.balance()) {
      this.wheelOpen.set(true);
      return;
    }
    const hint = hintFor(this.game(), p, s);
    if (hint.kind === 'done' || hint.kind === 'none') {
      this.flash(hint.text);
      return;
    }
    this.hintsUsed.update((n) => n + 1);
    this.hints.spend();
    this.coach.set(hint);
    this.glow(hint);
    this.haptics.tap();
    void this.persist();
  }

  /** Free: says whether the board holds a mistake, without saying where. */
  protected check(): void {
    const p = this.puzzle();
    const s = this.state();
    if (this.locked() || !p || !s) return;
    if (hasMistake(this.game(), p, s)) {
      this.flash('Something on the board is off. A hint can point to where.');
      this.haptics.warning();
    } else {
      this.flash('No mistakes so far. Keep going!');
      this.haptics.tap();
    }
  }

  protected dismissCoach(): void {
    this.coach.set(null);
    this.clearGlow();
  }

  private glow(hint: Hint): void {
    this.clearGlow();
    const wanted = new Set(hint.cells);
    this.host.nativeElement.querySelectorAll<HTMLElement>('.stage [data-i]').forEach((el) => {
      if (!wanted.has(Number(el.getAttribute('data-i')))) return;
      el.classList.add('hint-glow');
      if (hint.kind === 'mistake') el.classList.add('hint-mistake');
    });
    // The light stays on until the next move or "Got it", with a long safety timeout.
    this.glowTimer = setTimeout(() => this.clearGlow(), 20_000);
  }

  private clearGlow(): void {
    clearTimeout(this.glowTimer);
    this.host.nativeElement.querySelectorAll('.hint-glow').forEach((el) => el.classList.remove('hint-glow', 'hint-mistake'));
  }

  /** Free hints for playing: the zone boss every tenth level, and a one in three first win each day. */
  private reward(level: number): void {
    const gained = (this.hints.milestone(this.track(), level) ? 1 : 0) + (this.hints.firstWinOfDay() ? 1 : 0);
    if (gained) setTimeout(() => this.flash(`+${gained} hint${gained > 1 ? 's' : ''} earned 💡`), 1200);
  }

  private reopenResult = false;

  protected closeShare(): void {
    this.shareOpen.set(null);
    if (this.reopenResult) this.resultOpen.set(true);
    this.reopenResult = false;
  }

  protected share(): void {
    this.reopenResult = this.resultOpen();
    this.resultOpen.set(false);
    const game = this.game();
    const ms = this.finalMs() || this.attempt()?.elapsedMs || 0;
    const input = {
      game,
      name: this.info()?.name ?? 'Zenigma',
      label: this.daily() ? `Daily ${this.dateLabel()}` : `Level ${this.level()}`,
      puzzle: this.puzzle(),
      state: this.state(),
      ms,
      rank: this.daily() ? this.attempt()?.rank : null,
    };
    const board = shareCard(input);
    const text = this.daily() ? board : `${board}\n\nBeat my time: ${location.origin}${playLink(this.game(), this.variant()).join('/')}?level=${this.level()}&vs=${ms}`;
    this.shareOpen.set({
      text,
      card: {
        name: input.name,
        label: input.label,
        hue: this.info()?.hue ?? 160,
        grid: gridFromText(board),
        time: formatDuration(ms),
        rank: input.rank,
        stars: this.daily() ? undefined : this.stars(),
      },
    });
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
