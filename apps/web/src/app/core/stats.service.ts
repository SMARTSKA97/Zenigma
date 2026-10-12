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
}

export interface Rewards {
  freezes: number;
  maxFreezes: number;
  weekSolved: number;
  weekGoal: number;
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
