import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

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

  board(game: string, kind: 'daily' | 'practice', period: 'today' | 'week' | 'all'): Promise<Leaderboard> {
    return firstValueFrom(this.http.get<Leaderboard>(`${environment.apiBaseUrl}/leaderboards/${game}`, { params: { kind, period } }));
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
