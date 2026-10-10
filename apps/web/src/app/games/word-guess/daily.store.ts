import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';
import { DeviceService } from '../../core/device.service';
import { PrefsService } from '../../core/prefs.service';
import { SyncService } from '../../core/sync.service';
import { BoardController, BoardRow, BoardStats } from './board';
import { Guess, keyboardMarks, marksFromString, MAX_GUESSES, Mark, shareText, Status, WORD_LENGTH } from './engine';
import { REVEAL_MS } from './word-guess.store';
import { WordListService } from './word-list.service';

interface GuessDto {
  word: string;
  marks: string;
}
interface AttemptDto {
  hard: boolean;
  status: Status;
  guesses: GuessDto[];
  startedAt: string;
  answer: string | null;
  activeOnThisDevice: boolean;
}
interface DailyState {
  date: string;
  nextRolloverUtc: string;
  attempt: AttemptDto | null;
}
interface GuessResponse {
  guess: GuessDto;
  status: Status;
  answer: string | null;
}

/**
 * Where the daily screen is:
 * signin / offline / unavailable: cannot play right now; ready: not started yet; playing: your board;
 * blocked: another device is playing today's puzzle; finished: result.
 */
export type DailyPhase = 'loading' | 'signin' | 'offline' | 'unavailable' | 'ready' | 'playing' | 'blocked' | 'finished';

const SERVER_MESSAGES: Record<string, string> = {
  'too-short': 'Not enough letters',
  'not-a-word': 'Not in word list',
};

const ordinal = (n: number) => ['1st', '2nd', '3rd', '4th', '5th'][n - 1] ?? `${n}th`;

/** The daily puzzle: online only. The server holds the answer and checks every guess. */
@Injectable({ providedIn: 'root' })
export class DailyStore implements BoardController {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly device = inject(DeviceService);
  private readonly sync = inject(SyncService);
  private readonly prefs = inject(PrefsService);
  private readonly wordList = inject(WordListService);

  private readonly url = `${environment.apiBaseUrl}/daily/word-guess`;

  readonly phase = signal<DailyPhase>('loading');
  readonly date = signal<string | null>(null);
  readonly nextRolloverUtc = signal<string | null>(null);
  readonly hard = signal(false);

  private readonly guesses = signal<Guess[]>([]);
  readonly status = signal<Status>('playing');
  readonly answer = signal<string | null>(null);
  readonly current = signal('');
  readonly message = signal<string | null>(null);
  readonly shakeRow = signal<number | null>(null);
  readonly revealed = signal(0);
  readonly revealing = signal(false);
  readonly busy = signal(false);

  readonly rows = computed<BoardRow[]>(() => {
    const submitted = this.guesses();
    const typed = this.current();
    return Array.from({ length: MAX_GUESSES }, (_, r) => {
      if (r < submitted.length) return { letters: [...submitted[r].word], marks: submitted[r].marks, submitted: true };
      return { letters: r === submitted.length ? [...typed] : [], marks: [] as Mark[], submitted: false };
    });
  });

  readonly keyMarks = computed(() => keyboardMarks(this.guesses().slice(0, this.revealed())));
  readonly finished = computed(() => this.status() !== 'playing');
  readonly modeLocked = computed(() => this.guesses().length > 0 && !this.finished());

  readonly stats = computed<BoardStats>(() => {
    const results = this.sync
      .events()
      .filter((e) => e.kind === 'wordguess.daily')
      .map((e) => e.payload as { status: string; guesses: string[] });
    const won = results.filter((r) => r.status === 'won');
    return {
      played: results.length,
      won: won.length,
      distribution: Array.from({ length: MAX_GUESSES }, (_, i) => won.filter((r) => r.guesses.length === i + 1).length),
    };
  });

  /** Loads today's state from the server. Safe to call again to retry. */
  async load(): Promise<void> {
    this.phase.set('loading');
    if (!this.auth.signedIn()) return this.phase.set('signin');
    if (!this.sync.online()) return this.phase.set('offline');

    try {
      const deviceId = await this.device.deviceId();
      const state = await firstValueFrom(this.http.get<DailyState>(this.url, { params: { deviceId } }));
      this.apply(state);
    } catch (error) {
      this.phase.set(this.phaseForError(error));
    }
  }

  async start(): Promise<void> {
    this.busy.set(true);
    try {
      const deviceId = await this.device.deviceId();
      const state = await firstValueFrom(
        this.http.post<DailyState>(`${this.url}/start`, { deviceId, platform: this.device.platform, hard: this.prefs.hardMode() }),
      );
      this.apply(state);
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 409 && error.error?.state) {
        this.apply(error.error.state as DailyState, error.error.error === 'active-elsewhere');
      } else {
        this.phase.set(this.phaseForError(error));
      }
    } finally {
      this.busy.set(false);
    }
  }

  type(letter: string): void {
    if (!this.canInput() || this.current().length >= WORD_LENGTH) return;
    this.current.update((c) => c + letter.toLowerCase());
  }

  erase(): void {
    if (!this.canInput()) return;
    this.current.update((c) => c.slice(0, -1));
  }

  async enter(): Promise<void> {
    if (!this.canInput() || this.busy()) return;
    const word = this.current();
    const row = this.guesses().length;

    // Cheap checks first, on the device, so a typo never costs a round trip.
    if (word.length < WORD_LENGTH) return this.reject('Not enough letters', row);
    if (!(await this.wordList.load()).valid.has(word)) return this.reject('Not in word list', row);

    this.busy.set(true);
    try {
      const deviceId = await this.device.deviceId();
      const response = await firstValueFrom(this.http.post<GuessResponse>(`${this.url}/guess`, { deviceId, word }));
      const guess: Guess = { word: response.guess.word, marks: marksFromString(response.guess.marks) };

      this.guesses.update((g) => [...g, guess]);
      this.current.set('');
      this.status.set(response.status);
      this.answer.set(response.answer);
      this.revealing.set(true);

      const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      setTimeout(() => {
        this.revealed.set(this.guesses().length);
        this.revealing.set(false);
        if (response.status === 'won') {
          this.flash(['Genius!', 'Magnificent!', 'Impressive!', 'Splendid!', 'Great!', 'Phew!'][this.guesses().length - 1], 4000);
        }
        if (response.status === 'lost' && response.answer) this.flash(response.answer.toUpperCase(), 6000);
        if (response.status !== 'playing') {
          this.phase.set('finished');
          void this.sync.sync(); // the server logged the result; pull it into this device's history
        }
      }, reduce ? 0 : REVEAL_MS);
    } catch (error) {
      await this.handleGuessError(error, row);
    } finally {
      this.busy.set(false);
    }
  }

  share(): string {
    return shareText(
      { answer: this.answer() ?? '', hard: this.hard(), guesses: this.guesses(), status: this.status() },
      `Zenigma Word Guess ${this.date() ?? ''}`.trim(),
      this.prefs.highContrast(),
    );
  }

  private canInput(): boolean {
    return this.phase() === 'playing' && this.status() === 'playing' && !this.revealing();
  }

  /** Puts a server state on screen. `blocked` is true when another device holds today's attempt. */
  private apply(state: DailyState, blocked = false): void {
    this.date.set(state.date);
    this.nextRolloverUtc.set(state.nextRolloverUtc);
    const attempt = state.attempt;
    if (!attempt) {
      this.guesses.set([]);
      this.status.set('playing');
      this.answer.set(null);
      this.revealed.set(0);
      this.phase.set('ready');
      return;
    }

    const guesses = attempt.guesses.map((g) => ({ word: g.word, marks: marksFromString(g.marks) }));
    this.guesses.set(guesses);
    this.revealed.set(guesses.length);
    this.hard.set(attempt.hard);
    this.status.set(attempt.status);
    this.answer.set(attempt.answer);
    this.current.set('');
    this.phase.set(attempt.status !== 'playing' ? 'finished' : blocked || !attempt.activeOnThisDevice ? 'blocked' : 'playing');
  }

  private async handleGuessError(error: unknown, row: number): Promise<void> {
    if (error instanceof HttpErrorResponse) {
      const code = error.error?.error as string | undefined;
      if (error.status === 422 && code === 'hard-mode' && error.error?.detail) {
        const d = error.error.detail as { reason: string; letter: string; index?: number };
        return this.reject(
          d.reason === 'position' ? `${ordinal(d.index ?? 1)} letter must be ${d.letter.toUpperCase()}` : `Guess must contain ${d.letter.toUpperCase()}`,
          row,
        );
      }
      if (error.status === 422 && code && SERVER_MESSAGES[code]) return this.reject(SERVER_MESSAGES[code], row);
      if (error.status === 409 && error.error?.state) {
        // Another device took over, or the puzzle was already finished elsewhere: show the truth from the server.
        this.apply(error.error.state as DailyState, code === 'not-active-device');
        return;
      }
    }
    this.flash('Could not reach the server. Try again.');
  }

  private reject(text: string, row: number): void {
    this.flash(text);
    this.shakeRow.set(row);
    setTimeout(() => this.shakeRow.set(null), 500);
  }

  private flash(text: string, ms = 1600): void {
    this.message.set(text);
    setTimeout(() => this.message.update((m) => (m === text ? null : m)), ms);
  }

  private phaseForError(error: unknown): DailyPhase {
    if (error instanceof HttpErrorResponse && error.status === 404) return 'unavailable';
    return 'offline';
  }
}
