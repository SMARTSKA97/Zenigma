import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { ConnectionService } from './connection.service';

const STORE_KEY = 'zenigma.stats';

export interface GameStats {
  game: string;
  solved: number;
  current: number;
  best: number;
  bestMs: number | null;
  averageMs: number | null;
  averageGuesses: number | null;
  bestGuesses: number | null;
  /** Days (yyyy-MM-dd) solved in the last five weeks. */
  recent: string[];
  /** Days a freeze covered. */
  frozen: string[];
  /** Freezes held for this game. */
  freezes: number;
  /** Days of play still needed to earn the next freeze for this game. */
  nextFreezeIn: number;
}

export interface Rewards {
  /** Freezes held across all games. */
  freezes: number;
  /** The most one game can hold. */
  maxFreezes: number;
  /** Days played in a game that earn one freeze for it. */
  daysPerFreeze: number;
}

export interface Stats {
  date: string;
  rewards: Rewards;
  games: GameStats[];
}

@Injectable({ providedIn: 'root' })
export class StatsService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly connection = inject(ConnectionService);

  /** The last stats this device saw for the signed-in player, however old, or null. Lets Home draw at once with no request. */
  peek(): Stats | null {
    const id = this.auth.user()?.id;
    if (!id) return null;
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null') as { id: string; data: Stats } | null;
      return saved?.id === id ? saved.data : null;
    } catch {
      return null;
    }
  }

  async load(): Promise<Stats> {
    const data = await firstValueFrom(this.http.get<Stats>(`${environment.apiBaseUrl}/stats`));
    const id = this.auth.user()?.id;
    if (id) {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify({ id, data }));
      } catch {
        /* storage full or blocked: Home just asks next time */
      }
    }
    return data;
  }

  /** Refreshes only when the server is already awake, so a screen that merely shows a summary never wakes it. */
  async refreshIfAwake(): Promise<Stats | null> {
    return this.connection.serverReady() ? this.load() : null;
  }
}
