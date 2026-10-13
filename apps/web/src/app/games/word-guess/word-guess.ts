import { Component, computed, effect, HostListener, inject, OnDestroy, OnInit, signal, untracked } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ShareSheet } from '../../shared/share-sheet';
import { CardInput, gridFromText } from '../../shared/share-card';
import { ScreenGuardService } from '../../core/screen-guard.service';
import { BackService } from '../../core/back.service';
import { HintsService } from '../../core/hints.service';
import { HintWheel } from '../../shared/hint-wheel';
import { wordHint } from './engine';
import { PrefsService } from '../../core/prefs.service';
import { SyncService } from '../../core/sync.service';
import { BoardController } from './board';
import { DailyStore } from './daily.store';
import { Loader } from '../../shared/loader';
import { Switch } from '../../shared/switch';
import { SoonPill } from '../../shared/soon-pill';
import { Mark } from './engine';
import { WordGuessStore } from './word-guess.store';

const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

@Component({
  selector: 'app-word-guess',
  imports: [RouterLink, Loader, Switch, ShareSheet, HintWheel, SoonPill],
  templateUrl: './word-guess.html',
  styleUrl: './word-guess.scss',
})
export class WordGuess implements OnInit, OnDestroy {
  protected readonly practice = inject(WordGuessStore);
  protected readonly daily = inject(DailyStore);
  protected readonly prefs = inject(PrefsService);
  private readonly guard = inject(ScreenGuardService);
  protected readonly hints = inject(HintsService);
  protected readonly wheelOpen = signal(false);
  protected readonly nav = inject(BackService);
    private readonly sync = inject(SyncService);
  private readonly route = inject(ActivatedRoute);

  protected readonly cols = [0, 1, 2, 3, 4];
  protected readonly keyRows = KEY_ROWS.map((r) => [...r]);
  protected readonly shareOpen = signal<{ text: string; card: CardInput } | null>(null);
  protected readonly mode = signal<'daily' | 'practice'>('practice');
  private readonly now = signal(Date.now());
  private tick?: ReturnType<typeof setInterval>;

  protected readonly board = computed<BoardController>(() => (this.mode() === 'daily' ? this.daily : this.practice));

  protected readonly hardChecked = computed(() => (this.mode() === 'daily' && this.daily.phase() !== 'ready' ? this.daily.hard() : this.prefs.hardMode()));
  protected readonly hardDisabled = computed(() => {
    if (this.mode() === 'practice') return this.practice.modeLocked();
    return !['ready', 'loading', 'signin', 'offline', 'unavailable'].includes(this.daily.phase());
  });

  protected readonly lastSubmitted = computed(() => this.board().rows().filter((r) => r.submitted).length - 1);

  /** In daily mode, the message shown instead of the board when the puzzle cannot be played right now. */
  protected readonly panel = computed(() => {
    if (this.mode() === 'practice') return this.practice.loading() ? { title: 'Loading words', text: '', action: null, loading: true } : null;
    switch (this.daily.phase()) {
      case 'loading':
        return { title: 'Loading today\'s puzzle', text: '', action: null, loading: true };
      case 'signin':
        return { title: 'Sign in to play the daily puzzle', text: 'Everyone gets the same word each day, and your result is saved to your account.', action: 'signin' };
      case 'offline':
        return { title: 'The daily puzzle needs a connection', text: 'Check your internet and try again. Practice mode works offline.', action: 'retry' };
      case 'unavailable':
        return { title: 'Today\'s puzzle is not ready yet', text: 'Try again in a little while.', action: 'retry' };
      case 'ready':
        return { title: 'Today\'s puzzle', text: 'One attempt per day. Your timer starts with your first guess.', action: 'start' };
      case 'blocked':
        return { title: 'Playing on another device', text: 'Today\'s puzzle is open on another device. If it goes idle for a couple of minutes you can continue here, on the same board.', action: 'retry' };
      default:
        return null;
    }
  });

  protected readonly untilNext = computed(() => {
    const target = this.daily.nextRolloverUtc();
    if (!target) return '';
    const minutes = Math.max(0, Math.ceil((Date.parse(target) - this.now()) / 60000));
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  });

  ngOnInit(): void {
    this.setMode(this.route.snapshot.data['mode'] === 'daily' ? 'daily' : 'practice');
    this.tick = setInterval(() => this.now.set(Date.now()), 30_000); // local clock only, never a request
  }

  /** Screen stays on while playing; the daily also blocks screenshots on Android. */
  private readonly guardEffect = effect(() => {
    const secure = this.mode() === 'daily' && this.daily.phase() === 'playing';
    untracked(() => this.guard.enter(secure));
  });

  ngOnDestroy(): void {
    clearInterval(this.tick);
    this.guard.leave();
  }

  private setMode(mode: 'daily' | 'practice'): void {
    this.mode.set(mode);
    if (mode === 'daily') void this.daily.load();
    else void this.practice.start();
  }

  @HostListener('window:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;

    const board = this.board();
    if (event.key === 'Enter') {
      // A focused button handles Enter itself (activating it); don't also submit.
      if (target?.tagName === 'BUTTON') return;
      event.preventDefault();
      void board.enter();
    } else if (event.key === 'Backspace') {
      board.erase();
    } else if (/^[a-zA-Z]$/.test(event.key)) {
      board.type(event.key);
    }
  }

  protected label(letter: string | undefined, mark: Mark | undefined): string {
    if (!letter) return 'empty';
    return mark ? `${letter}, ${mark === 'correct' ? 'correct' : mark === 'present' ? 'in word, wrong place' : 'not in word'}` : letter;
  }

  /** The guesses made so far, as coloured squares for the result card and the share text. */
  protected submittedRows() {
    return this.board().rows().filter((r) => r.submitted);
  }

  protected barWidth(count: number): string {
    const max = Math.max(1, ...this.board().stats().distribution);
    return `${Math.max(8, (count / max) * 100)}%`;
  }

  /** Practice only. Each hint on a word tells a little more, and costs one from the pool shared with every game. */
  protected useHint(): void {
    const state = this.practice.state();
    if (!state || this.board().finished() || this.board().revealing()) return;
    if (!this.hints.balance()) {
      this.wheelOpen.set(true);
      return;
    }
    const text = wordHint(state, this.practice.hintsUsed());
    if (!text) {
      this.practice.message.set('No more hints for this word. You have got this!');
      return;
    }
    this.hints.spend();
    this.practice.showHint(text);
  }

  protected share(): void {
    const text = this.board().share();
    const rows = this.submittedRows();
    const won = this.board().status() === 'won';
    this.shareOpen.set({
      text,
      card: {
        name: 'Word Guess',
        label: this.mode() === 'daily' ? `Daily ${this.daily.date() ?? ''}`.trim() : 'Practice',
        hue: 160,
        grid: gridFromText(text),
        score: `${won ? rows.length : 'X'}/6`,
      },
    });
  }

  /** A clear "pressed" look the moment a key is touched (the plain :active state is too brief to notice on a quick tap). */
  protected press(event: PointerEvent): void {
    const key = event.currentTarget as HTMLElement;
    key.classList.add('pressed');
    setTimeout(() => key.classList.remove('pressed'), 170);
  }
}
