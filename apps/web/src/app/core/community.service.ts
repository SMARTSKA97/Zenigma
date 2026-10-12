import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Community {
  players: number;
  activeToday: number;
  activeWeek: number;
}

/** Public totals for the home screen (people with an account, and how many were around lately). Quiet when offline. */
@Injectable({ providedIn: 'root' })
export class CommunityService {
  private readonly http = inject(HttpClient);
  readonly counts = signal<Community | null>(null);
  private loadedAt = 0;

  async load(): Promise<void> {
    // The server caches for 15 seconds, so asking more often is pointless.
    if (Date.now() - this.loadedAt < 15_000) return;
    this.loadedAt = Date.now();
    try {
      this.counts.set(await firstValueFrom(this.http.get<Community>(`${environment.apiBaseUrl}/public/community`)));
    } catch {
      this.loadedAt = 0; // offline or waking up: try again next time
    }
  }
}
