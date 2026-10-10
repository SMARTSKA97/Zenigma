import { Component, computed, HostListener, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { PrefsService } from '../../core/prefs.service';
import { SyncService } from '../../core/sync.service';
import { BoardController } from './board';
import { DailyStore } from './daily.store';
import { Mark } from './engine';
import { WordGuessStore } from './word-guess.store';

const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

@Component({
  selector: 'app-word-guess',
  imports: [RouterLink],
  template: `
    <div class="game">
      <header class="bar">
        <a routerLink="/" class="back" aria-label="Back to games">&larr;</a>
        <h1>Word Guess</h1>
        <label class="switch">
          <input
            type="checkbox"
            [checked]="hardChecked()"
            [disabled]="hardDisabled()"
            (change)="prefs.setHardMode($any($event.target).checked)"
          />
          <span>Hard</span>
        </label>
      </header>

      <div class="modes" role="tablist" aria-label="Mode">
        <button type="button" role="tab" [attr.aria-selected]="mode() === 'daily'" [class.on]="mode() === 'daily'" (click)="setMode('daily')">
          Daily
        </button>
        <button type="button" role="tab" [attr.aria-selected]="mode() === 'practice'" [class.on]="mode() === 'practice'" (click)="setMode('practice')">
          Practice
        </button>
      </div>

      <div class="toast" role="status" aria-live="polite">
        @if (board().message(); as text) {
          <span>{{ text }}</span>
        }
      </div>

      @if (panel(); as p) {
        <section class="card panel">
          <h2>{{ p.title }}</h2>
          <p class="muted">{{ p.text }}</p>
          @if (p.action === 'signin') {
            <a class="button" routerLink="/account">Sign in</a>
          } @else if (p.action === 'retry') {
            <button type="button" (click)="daily.load()">Try again</button>
          } @else if (p.action === 'start') {
            <button type="button" [disabled]="daily.busy()" (click)="daily.start()">Start today's puzzle</button>
          }
          <button type="button" class="secondary" (click)="setMode('practice')">Play practice instead</button>
        </section>
      } @else {
        @if (mode() === 'daily' && daily.date()) {
          <p class="muted date">Daily &middot; {{ daily.date() }}{{ daily.hard() ? ' &middot; Hard' : '' }}</p>
        }

        <div class="board" role="grid" aria-label="Guesses">
          @for (row of board().rows(); track $index; let r = $index) {
            <div class="row-tiles" role="row" [class.shake]="board().shakeRow() === r">
              @for (col of cols; track col) {
                <div
                  class="tile"
                  role="gridcell"
                  [class.filled]="!!row.letters[col]"
                  [class.flip]="row.submitted"
                  [class.win]="board().status() === 'won' && row.submitted && r === lastSubmitted()"
                  [attr.data-mark]="row.submitted ? row.marks[col] : null"
                  [style.--i]="col"
                  [attr.aria-label]="label(row.letters[col], row.marks[col])"
                >
                  {{ row.letters[col] }}
                </div>
              }
            </div>
          }
        </div>

        @if (board().finished() && !board().revealing()) {
          <section class="card result">
            <h2>{{ board().status() === 'won' ? 'Solved' : 'The word was ' + (board().answer() ?? '').toUpperCase() }}</h2>
            <p class="muted">Played {{ board().stats().played }} &middot; Won {{ board().stats().won }}</p>
            <div class="dist" aria-label="Guess distribution">
              @for (n of board().stats().distribution; track $index) {
                <div class="dist-row">
                  <span>{{ $index + 1 }}</span>
                  <span class="dist-bar" [style.--w]="barWidth(n)">{{ n }}</span>
                </div>
              }
            </div>
            <div class="row">
              <button type="button" (click)="share()">{{ copied() ? 'Copied' : 'Share' }}</button>
              @if (mode() === 'practice') {
                <button type="button" class="secondary" (click)="practice.newWord()">New word</button>
              } @else {
                <span class="muted">Next puzzle in {{ untilNext() }}</span>
              }
            </div>
          </section>
        } @else {
          <div class="keyboard" aria-label="Keyboard">
            @for (keys of keyRows; track keys; let i = $index) {
              <div class="keys">
                @if (i === 2) {
                  <button type="button" class="key wide" (click)="board().enter()">Enter</button>
                }
                @for (k of keys; track k) {
                  <button type="button" class="key" [attr.data-mark]="board().keyMarks().get(k) ?? null" (click)="board().type(k)">
                    {{ k }}
                  </button>
                }
                @if (i === 2) {
                  <button type="button" class="key wide" aria-label="Backspace" (click)="board().erase()">&#9003;</button>
                }
              </div>
            }
          </div>
        }
      }
    </div>
  `,
  styleUrl: './word-guess.scss',
})
export class WordGuess implements OnInit, OnDestroy {
  protected readonly practice = inject(WordGuessStore);
  protected readonly daily = inject(DailyStore);
  protected readonly prefs = inject(PrefsService);
  private readonly auth = inject(AuthService);
  private readonly sync = inject(SyncService);

  protected readonly cols = [0, 1, 2, 3, 4];
  protected readonly keyRows = KEY_ROWS.map((r) => [...r]);
  protected readonly copied = signal(false);
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
    if (this.mode() === 'practice') return this.practice.loading() ? { title: 'Loading words...', text: '', action: null } : null;
    switch (this.daily.phase()) {
      case 'loading':
        return { title: 'Loading today\'s puzzle...', text: '', action: null };
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
    let saved: string | null = null;
    try {
      saved = localStorage.getItem('zenigma.wordguess.mode');
    } catch {
      /* default */
    }
    // Daily is the headline mode when it can actually be played; otherwise open practice.
    const preferred = saved ?? (this.auth.signedIn() && this.sync.online() ? 'daily' : 'practice');
    this.setMode(preferred === 'daily' ? 'daily' : 'practice');
    this.tick = setInterval(() => this.now.set(Date.now()), 30_000); // local clock only, never a request
  }

  ngOnDestroy(): void {
    clearInterval(this.tick);
  }

  protected setMode(mode: 'daily' | 'practice'): void {
    this.mode.set(mode);
    try {
      localStorage.setItem('zenigma.wordguess.mode', mode);
    } catch {
      /* not remembered */
    }
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

  protected barWidth(count: number): string {
    const max = Math.max(1, ...this.board().stats().distribution);
    return `${Math.max(8, (count / max) * 100)}%`;
  }

  protected async share(): Promise<void> {
    const text = this.board().share();
    try {
      if (navigator.share) await navigator.share({ text });
      else await navigator.clipboard.writeText(text);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1800);
    } catch {
      /* the person cancelled the share sheet */
    }
  }
}
