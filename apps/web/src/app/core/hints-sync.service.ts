import { HttpClient } from '@angular/common/http';
import { effect, inject, Injectable, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { ConnectionService } from './connection.service';
import { HintsService } from './hints.service';

/** Keeps the hint balance of a signed-in player the same on every device. Idle when offline mode is on or the server is asleep. */
@Injectable({ providedIn: 'root' })
export class HintsSyncService {
  private readonly http = inject(HttpClient);
  private readonly hints = inject(HintsService);
  private readonly auth = inject(AuthService);
  private readonly conn = inject(ConnectionService);
  private timer?: ReturnType<typeof setTimeout>;
  private running = false;

  constructor() {
    effect(() => {
      this.hints.version();
      const ready = this.conn.serverReady() && this.auth.signedIn();
      if (ready) untracked(() => this.schedule());
    });
  }

  private schedule(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.sync(), 1500);
  }

  async sync(): Promise<void> {
    if (this.running || !this.auth.signedIn() || !this.conn.serverReady()) return;
    this.running = true;
    try {
      const entries = this.hints.pending();
      const response = await firstValueFrom(
        this.http.post<{ balance: number; short?: number }>(`${environment.apiBaseUrl}/hints/sync`, { entries, localBalance: this.hints.balance() }),
      );
      this.hints.applyServer(entries.map((e) => e.id), response.balance);
      // Two devices spent the last hint at once: the server could only pay for one of them.
      if (response.short) this.hints.gift.set('A hint you used on another device had already been spent, so your balance is lower now.');
    } catch {
      /* offline or asleep: the entries stay queued and go next time */
    } finally {
      this.running = false;
    }
  }
}
