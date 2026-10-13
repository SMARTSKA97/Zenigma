import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

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

  load(): Promise<Stats> {
    return firstValueFrom(this.http.get<Stats>(`${environment.apiBaseUrl}/stats`));
  }
}
