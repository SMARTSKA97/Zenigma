import { Component, computed, HostListener, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PrefsService } from '../../core/prefs.service';
import { SyncService } from '../../core/sync.service';
import { BoardController } from './board';
import { DailyStore } from './daily.store';
import { Loader } from '../../shared/loader';
import { Switch } from '../../shared/switch';
import { Mark } from './engine';
import { WordGuessStore } from './word-guess.store';

const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

@Component({
  selector: 'app-word-guess',
  imports: [RouterLink, Loader, Switch],
  template: `
    <div class="game">
      <header class="bar">
        <a routerLink="/" class="back" aria-label="Back to games">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        </a>
        <div class="title">
          <h1>Word Guess</h1>
          <p class="muted sub">{{ mode() === 'daily' ? 'Daily' + (daily.date() ? ' · ' + daily.date() : '') : 'Practice' }}</p>
        </div>
        <app-switch [checked]="hardChecked()" [disabled]="hardDisabled()" (checkedChange)="prefs.setHardMode($event)">Hard</app-switch>
      </header>

      <div class="toast" role="status" aria-live="polite">
        @if (board().message(); as text) {
          <span>{{ text }}</span>
        }
      </div>

      @if (panel(); as p) {
        @if (p.loading) {
          <div class="board" aria-busy="true" aria-label="Loading">
            @for (r of [0, 1, 2, 3, 4, 5]; track r) {
              <div class="row-tiles">
                @for (c of cols; track c) {
                  <div class="tile skeleton" [style.animation-delay]="(r + c) * 0.06 + 's'"></div>
                }
              </div>
            }
          </div>
          <p class="muted loading"><app-loader [size]="16" /> {{ p.title }}</p>
        } @else {
          <section class="card panel">
            <h2>{{ p.title }}</h2>
            <p class="muted">{{ p.text }}</p>
            <div class="actions">
              @if (p.action === 'signin') {
                <a class="button" routerLink="/account">Sign in</a>
              } @else if (p.action === 'retry') {
                <button type="button" (click)="daily.load()">Try again</button>
              } @else if (p.action === 'start') {
                <button type="button" [disabled]="daily.busy()" (click)="daily.start()">
                  @if (daily.busy()) {
                    <app-loader [size]="16" />
                  }
                  Start today's puzzle
                </button>
              }
              <a class="button secondary" routerLink="/games/word-guess">Play practice</a>
            </div>
          </section>
        }
      } @else {
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
            <div class="recap">
              <div class="grid" role="img" [attr.aria-label]="'Your guesses: ' + submittedRows().length + ' of 6'">
                @for (row of submittedRows(); track $index) {
                  <div class="gr">
                    @for (m of row.marks; track $index) {
                      <i [attr.data-mark]="m"></i>
                    }
                  </div>
                }
              </div>
              <div class="score">
                <strong>{{ board().status() === 'won' ? submittedRows().length + '/6' : 'X/6' }}</strong>
                <span class="muted">{{ board().status() === 'won' ? (submittedRows().length === 1 ? 'Got it first try' : 'Solved in ' + submittedRows().length) : 'Better luck next time' }}</span>
              </div>
            </div>
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
                <a class="button secondary" routerLink="/ranks" [queryParams]="{ game: 'word-guess', kind: 'practice' }">Leaderboard</a>
              } @else {
                <a class="button secondary" routerLink="/ranks" [queryParams]="{ game: 'word-guess', kind: 'daily' }">Leaderboard</a>
                <span class="muted">Next puzzle in {{ untilNext() }}</span>
              }
            </div>
          </section>
        } @else {
          <div class="keyboard" aria-label="Keyboard">
            @for (keys of keyRows; track keys; let i = $index) {
              <div class="keys">
                @if (i === 2) {
                  <button type="button" class="key wide" (pointerdown)="press($event)" (click)="board().enter()">Enter</button>
                }
                @for (k of keys; track k) {
                  <button type="button" class="key" [attr.data-k]="k" [attr.data-mark]="board().keyMarks().get(k) ?? null" (pointerdown)="press($event)" (click)="board().type(k)">
                    {{ k }}
                  </button>
                }
                @if (i === 2) {
                  <button type="button" class="key wide" aria-label="Backspace" (pointerdown)="press($event)" (click)="board().erase()">&#9003;</button>
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
    private readonly sync = inject(SyncService);
  private readonly route = inject(ActivatedRoute);

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

  ngOnDestroy(): void {
    clearInterval(this.tick);
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

  /** A clear "pressed" look the moment a key is touched (the plain :active state is too brief to notice on a quick tap). */
  protected press(event: PointerEvent): void {
    const key = event.currentTarget as HTMLElement;
    key.classList.add('pressed');
    setTimeout(() => key.classList.remove('pressed'), 170);
  }
}
