import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

/** A board fetched less than this long ago is reused without asking the server again. */
const FRESH_MS = 60_000;
const STORE_KEY = 'zenigma.boards';
const MAX_STORED = 24;

export interface LeaderEntry {
  rank: number;
  name: string;
  /** Today's daily: guesses (Word Guess) or milliseconds. Other boards: how many puzzles or levels were solved. */
  value: number;
  /** Milliseconds, where it breaks a tie. */
  secondary: number;
  isMe: boolean;
}

export interface Leaderboard {
  game: string;
  kind: 'daily' | 'practice';
  period: 'today' | 'week' | 'all';
  date: string | null;
  entries: LeaderEntry[];
  me: LeaderEntry | null;
}

export interface DailyGameStatus {
  game: string;
  available: boolean;
  status: 'new' | 'playing' | 'solved' | 'won' | 'lost';
  elapsedMs: number | null;
  guesses: number | null;
  rank: number | null;
}

export interface DailyHub {
  date: string;
  nextRolloverUtc: string;
  games: DailyGameStatus[];
}

@Injectable({ providedIn: 'root' })
export class LeaderboardService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  /** Boards seen before, newest use last, kept on the device so a board can show instantly and refresh quietly. */
  private readonly seen = new Map<string, { at: number; data: Leaderboard }>(this.restore());
  private readonly inflight = new Map<string, Promise<Leaderboard>>();

  /** The last board seen for these choices, however old, or null. For showing something at once while the fresh one loads. */
  peekBoard(game: string, kind: 'daily' | 'practice', period: 'today' | 'week' | 'all', circle?: string | null): Leaderboard | null {
    return this.seen.get(this.key(`${game}:${kind}:${period}:${circle ?? ''}`))?.data ?? null;
  }

  /** Forget everything remembered (after a result changes the boards, or on sign-out). */
  clearBoards(): void {
    this.seen.clear();
    try {
      localStorage.removeItem(STORE_KEY);
    } catch {
      /* nothing stored */
    }
  }

  board(game: string, kind: 'daily' | 'practice', period: 'today' | 'week' | 'all', circle?: string | null): Promise<Leaderboard> {
    const params: Record<string, string> = { kind, period };
    if (circle) params['circle'] = circle;
    return this.cached(`${game}:${kind}:${period}:${circle ?? ''}`, `${environment.apiBaseUrl}/leaderboards/${game}`, params);
  }

  /** The daily mind-training set, ranked by points (value) over the days finished (secondary). */
  mindBoard(period: 'today' | 'week'): Promise<Leaderboard> {
    return this.cached(`mind:${period}`, `${environment.apiBaseUrl}/leaderboards/mind-daily`, { period });
  }

  /** The featured level of a week (its Monday as yyyy-mm-dd): fewest mistakes first, then fastest. Players who used hints are not ranked. */
  featuredBoard(week: string): Promise<Leaderboard> {
    return this.cached(`featured:${week}`, `${environment.apiBaseUrl}/leaderboards/featured`, { week });
  }

  /** A word daily's board (Pinpoint, Chain Link, Crossclimb, Wend): points first, then the faster time. */
  wordDailyBoard(game: string, period: 'today' | 'week'): Promise<Leaderboard> {
    return this.cached(`wdaily:${game}:${period}`, `${environment.apiBaseUrl}/leaderboards/word-daily`, { game, period });
  }

  /** Reuses a board fetched in the last minute (no request, so a sleeping server is not woken for it); otherwise asks, once for any number of callers. */
  private cached(name: string, url: string, params: Record<string, string>): Promise<Leaderboard> {
    const key = this.key(name);
    const hit = this.seen.get(key);
    if (hit && Date.now() - hit.at < FRESH_MS) return Promise.resolve(hit.data);
    const running = this.inflight.get(key);
    if (running) return running;
    const request = firstValueFrom(this.http.get<Leaderboard>(url, { params }))
      .then((data) => {
        this.seen.delete(key);
        this.seen.set(key, { at: Date.now(), data });
        while (this.seen.size > MAX_STORED) this.seen.delete(this.seen.keys().next().value as string);
        this.persist();
        return data;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, request);
    return request;
  }

  /** Boards carry "is this me", so what is remembered belongs to the signed-in player. */
  private key(name: string): string {
    return `${this.auth.user()?.id ?? 'guest'}|${name}`;
  }

  private persist(): void {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify([...this.seen.entries()]));
    } catch {
      /* the memory copy still works */
    }
  }

  private restore(): [string, { at: number; data: Leaderboard }][] {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]');
      return Array.isArray(raw) ? raw.slice(-MAX_STORED) : [];
    } catch {
      return [];
    }
  }

  dailyHub(): Promise<DailyHub> {
    return firstValueFrom(this.http.get<DailyHub>(`${environment.apiBaseUrl}/daily`));
  }
}

/** 83000 -> "1:23", 3723000 -> "1:02:03" */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
