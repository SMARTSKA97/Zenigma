import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { ConnectionService } from './connection.service';

const STORE_KEY = 'zenigma.community';

export interface Community {
  players: number;
  activeToday: number;
  activeWeek: number;
}

/** Public totals for the home screen (people with an account, and how many were around lately). Quiet when offline. */
@Injectable({ providedIn: 'root' })
export class CommunityService {
  private readonly http = inject(HttpClient);
  private readonly connection = inject(ConnectionService);
  readonly counts = signal<Community | null>(this.restore());
  private loadedAt = 0;

  /** Asks the server only when it is already awake; a sleeping one keeps showing the numbers seen last. */
  async load(): Promise<void> {
    if (!this.connection.serverReady()) return;
    // The server caches for 15 seconds, so asking more often is pointless.
    if (Date.now() - this.loadedAt < 15_000) return;
    this.loadedAt = Date.now();
    try {
      const counts = await firstValueFrom(this.http.get<Community>(`${environment.apiBaseUrl}/public/community`));
      this.counts.set(counts);
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(counts));
      } catch {
        /* the numbers are just not remembered */
      }
    } catch {
      this.loadedAt = 0; // offline or waking up: try again next time
    }
  }

  private restore(): Community | null {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null') as Community | null;
    } catch {
      return null;
    }
  }
}
