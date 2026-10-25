import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { isAndroidDevice, isIosDevice } from './install.service';
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
const PENDING = 'zenigma.upi.pending';

export interface PendingPayment {
  amountInr: number | null;
  at: number;
}

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
  /** The generic UPI link: on Android this opens the system chooser of every UPI app. */
  readonly upiLink = this.upiUrl();
  readonly isIos = isIosDevice();
  readonly isAndroid = isAndroidDevice();
  /** Phones can open a UPI app; computers show a QR code to scan with one instead. */
  readonly isMobile = this.isIos || this.isAndroid;
  /** Whether the UPI panel (amount, apps, QR) is open. */
  readonly paying = signal(false);
  /** A payment the person started in a UPI app and has not confirmed yet. Kept on the device so it survives the app being closed while they pay. */
  readonly pending = signal<PendingPayment | null>(this.readPending());

  constructor() {
    if (typeof document === 'undefined') return;
    // Coming back from the UPI app: open the sheet on "Did it go through?"
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.pending()) this.showReturn();
    });
    if (this.pending()) setTimeout(() => this.showReturn(), 600);
  }

  /** A upi:// address for the given amount (rupees); the amount is left out when it is not set so the person types it. */
  upiUrl(amount?: number | null, scheme = 'upi://pay'): string {
    const q = new URLSearchParams({ pa: environment.support.upiId, pn: 'Zenigma', cu: 'INR', tn: 'Zenigma support' });
    if (amount && amount > 0) q.set('am', String(Math.round(amount)));
    return `${scheme}?${q.toString().replace(/\+/g, '%20')}`;
  }

  /** iOS has no chooser for upi://, so each popular app gets its own address, then the generic one. */
  upiApps(amount?: number | null): { name: string; color: string; href: string }[] {
    const link = (scheme: string) => this.upiUrl(amount, scheme);
    return [
      { name: 'Google Pay', color: '#4285f4', href: link('gpay://upi/pay') },
      { name: 'PhonePe', color: '#5f259f', href: link('phonepe://pay') },
      { name: 'Paytm', color: '#00b9f1', href: link('paytmmp://pay') },
      { name: 'CRED', color: '#1c1c1c', href: link('credpay://upi/pay') },
      { name: 'Any other UPI app', color: '#22c55e', href: link('upi://pay') },
    ];
  }

  /** A QR code (as an image address) for the UPI link, to scan with any UPI app. */
  async qr(amount?: number | null): Promise<string> {
    const mod = await import('qrcode');
    // The package is CommonJS: depending on the bundler its functions sit on the module or on its default export.
    const toDataURL = mod.toDataURL ?? (mod as unknown as { default: typeof mod }).default.toDataURL;
    return toDataURL(this.upiUrl(amount), { margin: 1, width: 360, errorCorrectionLevel: 'M' });
  }

  /** The person is about to pay: remember it so we can ask, when they come back, whether it went through. */
  startPayment(amountInr: number | null): void {
    this.setPending({ amountInr, at: Date.now() });
  }

  clearPending(): void {
    this.setPending(null);
  }

  private showReturn(): void {
    const p = this.pending();
    if (!p) return;
    if (Date.now() - p.at > 6 * 60 * 60 * 1000) return this.clearPending();
    this.open.set(true);
    this.paying.set(true);
  }

  private setPending(p: PendingPayment | null): void {
    this.pending.set(p);
    try {
      if (p) localStorage.setItem(PENDING, JSON.stringify(p));
      else localStorage.removeItem(PENDING);
    } catch {
      /* no storage: the question is asked while the app stays open */
    }
  }

  private readPending(): PendingPayment | null {
    try {
      const p = JSON.parse(localStorage.getItem(PENDING) ?? 'null') as PendingPayment | null;
      return p && typeof p.at === 'number' ? p : null;
    } catch {
      return null;
    }
  }
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
