import { HttpClient } from '@angular/common/http';
import { effect, inject, Injectable, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { MindStore } from '../games/mind/mind-store';
import { AuthService } from './auth.service';
import { ConnectionService } from './connection.service';

export interface SkillCompare {
  skill: string;
  mine: number | null;
  average: number | null;
  percentile: number | null;
}
export interface GroupCompare {
  name: string;
  players: number;
  ready: boolean;
  skills: SkillCompare[];
}
export interface MindCompare {
  ageGroup: string | null;
  gender: string | null;
  sharing: boolean;
  groups: GroupCompare[];
}

/** Uploads a signed-in player's best mind-training marks, and loads how they compare with other players. */
@Injectable({ providedIn: 'root' })
export class MindSyncService {
  private readonly http = inject(HttpClient);
  private readonly store = inject(MindStore);
  private readonly auth = inject(AuthService);
  private readonly conn = inject(ConnectionService);
  private timer?: ReturnType<typeof setTimeout>;
  private sent = '';

  readonly compare = signal<MindCompare | null>(null);
  readonly loading = signal(false);

  constructor() {
    effect(() => {
      const marks = this.store.marks();
      const ready = this.conn.serverReady() && this.auth.signedIn();
      if (ready && marks.length) untracked(() => this.schedule(marks));
    });
  }

  private schedule(marks: { game: string; skill: string; pct: number; plays: number }[]): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.upload(marks), 2000);
  }

  private async upload(marks: { game: string; skill: string; pct: number; plays: number }[]): Promise<void> {
    const body = JSON.stringify(marks);
    if (body === this.sent) return;
    try {
      await firstValueFrom(this.http.put(`${environment.apiBaseUrl}/mind/scores`, { scores: marks }));
      this.sent = body;
    } catch {
      /* offline or asleep: sent next time */
    }
  }

  /** Loads the comparison (signed in and online). Null while unavailable. */
  async load(): Promise<void> {
    if (!this.auth.signedIn() || this.conn.offlineMode()) return;
    this.loading.set(true);
    try {
      // Make sure the latest marks are on the server before comparing.
      clearTimeout(this.timer);
      await this.upload(this.store.marks());
      this.compare.set(await firstValueFrom(this.http.get<MindCompare>(`${environment.apiBaseUrl}/mind/compare`)));
    } catch {
      /* keep what we had */
    } finally {
      this.loading.set(false);
    }
  }
}
