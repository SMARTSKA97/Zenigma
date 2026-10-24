import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { ConnectionService } from './connection.service';
import { UpdaterService } from './updater.service';
import { WalletService } from './wallet.service';

export interface Supporter {
  name: string;
  /** Rupees in total; null when the supporter keeps the amount private. */
  totalInr: number | null;
  /** What was paid, as it was paid, e.g. "$5 (₹425)"; null when the supporter keeps the amount private. */
  display?: string | null;
  tier: 'supporter' | 'patron' | 'champion';
}

const KEY = 'zenigma.supporters';

/** Where people can chip in for the running costs, who already has, and whether the Support sheet is open. */
@Injectable({ providedIn: 'root' })
export class SupportService {
  private readonly updater = inject(UpdaterService);
  private readonly http = inject(HttpClient);
  private readonly conn = inject(ConnectionService);
  readonly wallet = inject(WalletService);
  readonly config = environment.support;
  readonly open = signal(false);
  /** The names on the wall: the last list the server gave, kept on the device so it shows offline too. */
  readonly supporters = signal<Supporter[]>(this.read());
  readonly tier = this.wallet.supporterTier;
  /** Tips are for the website and sideloaded builds: Google Play wants its own billing for anything paid inside an app from the Play Store. */
  readonly canDonate = computed(
    () =>
      !this.updater.fromPlay() &&
      !!(this.config.upiId || this.config.sponsorsUrl || this.config.coffeeUrl || this.config.kofiUrl || this.config.paypalUrl),
  );
  readonly upiLink = `upi://pay?pa=${encodeURIComponent(environment.support.upiId)}&pn=${encodeURIComponent('Zenigma')}&cu=INR`;
  private loadedAt = 0;

  /** Refreshes the wall. Never wakes the server: only asks while it is awake anyway. */
  async load(): Promise<void> {
    if (Date.now() - this.loadedAt < 60_000 || this.conn.offlineMode() || !navigator.onLine || !this.conn.serverReady()) return;
    this.loadedAt = Date.now();
    try {
      const list = await firstValueFrom(this.http.get<Supporter[]>(`${environment.apiBaseUrl}/public/supporters`));
      this.supporters.set(list);
      try {
        localStorage.setItem(KEY, JSON.stringify(list));
      } catch {
        /* no storage: the wall shows while the app is open */
      }
    } catch {
      this.loadedAt = 0;
    }
  }

  /** Opening the Contributors page is a reason to reach the server: wake it if needed, then refresh the wall. */
  async refresh(): Promise<void> {
    if (await this.conn.wake()) await this.load();
  }

  /** "I supported": tells the owner (by email) so the payment can be checked and the perks switched on. */
  async claim(amountInr: number, method: string, name: string): Promise<'sent' | 'unavailable' | 'limit' | 'failed'> {
    try {
      await firstValueFrom(this.http.post(`${environment.apiBaseUrl}/support/claim`, { amountInr, method, name }));
      return 'sent';
    } catch (e) {
      const status = (e as { status?: number }).status;
      return status === 503 ? 'unavailable' : status === 429 ? 'limit' : 'failed';
    }
  }

  private read(): Supporter[] {
    try {
      const list = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Supporter[];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }
}
