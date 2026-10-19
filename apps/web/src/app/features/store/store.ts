import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { BackService } from '../../core/back.service';
import { ConnectionService } from '../../core/connection.service';
import { HapticsService } from '../../core/haptics.service';
import { HintsService } from '../../core/hints.service';
import { PrefsService } from '../../core/prefs.service';
import { SoundService } from '../../core/sound.service';
import { FREE_ACCENTS, PRIZE_SLICES, STREAK_UNLOCKS, StoreItem, WalletService } from '../../core/wallet.service';
import { QuestsCard } from '../../shared/quests-card';

type Shelf = 'hints' | 'accent' | 'skin';

const SWATCH: Record<string, string> = {
  'accent:rose': '#be185d', 'accent:teal': '#0f766e', 'accent:lime': '#4d7c0f', 'accent:sky': '#0369a1', 'accent:crimson': '#b91c1c', 'accent:graphite': '#475569',
  'skin:midnight': '#101535', 'skin:paper': '#f4ecd9', 'skin:terminal': '#0b140d', 'skin:sakura': '#fdf0f3',
};
const SLICE_LABEL: Record<string, string> = { c10: '10', c20: '20', c30: '30', c50: '50', c100: '100', h1: '💡1', h2: '💡2' };
const SLICE_KEY = (kind: string, amount: number): string => (kind === 'hints' ? `h${amount}` : `c${amount}`);

/** The store: coins, the daily wheel, today's quests, and things to spend coins on. It needs a connection so the balance is the same on every device. */
@Component({
  selector: 'app-store',
  imports: [RouterLink, QuestsCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './store.html',
  styleUrl: './store.scss',
})
export class Store implements OnInit {
  protected readonly wallet = inject(WalletService);
  protected readonly auth = inject(AuthService);
  protected readonly conn = inject(ConnectionService);
  protected readonly hints = inject(HintsService);
  protected readonly prefs = inject(PrefsService);
  protected readonly nav = inject(BackService);
  private readonly haptics = inject(HapticsService);
  private readonly sound = inject(SoundService);

  protected readonly shelf = signal<Shelf>('hints');
  protected readonly shelves: { id: Shelf; label: string }[] = [
    { id: 'hints', label: '💡 Hints' },
    { id: 'accent', label: '🎨 Colours' },
    { id: 'skin', label: '🌙 Themes' },
  ];
  protected readonly angle = signal(0);
  protected readonly spinning = signal(false);
  protected readonly prize = signal<string | null>(null);
  protected readonly toast = signal<string | null>(null);
  protected readonly busy = signal<string | null>(null);
  protected readonly slices = PRIZE_SLICES;
  protected readonly online = computed(() => this.auth.signedIn() && !this.conn.offlineMode() && this.conn.online());
  protected readonly items = computed(() => this.wallet.catalog().filter((i) => i.kind === this.shelf()));
  private rounds = 0;

  ngOnInit(): void {
    void this.wallet.refresh();
  }

  protected label(slice: string): string {
    return SLICE_LABEL[slice];
  }

  protected colour(i: number): string {
    return ['#2f9e8f', '#e0952b', '#7a5bc4', '#3b82c4', '#2f9e8f', '#c4533b', '#7a5bc4', '#d1a21a'][i];
  }

  protected slicePath(i: number): string {
    const a0 = ((i * 45 - 90) * Math.PI) / 180;
    const a1 = (((i + 1) * 45 - 90) * Math.PI) / 180;
    const [x0, y0, x1, y1] = [Math.cos(a0) * 96, Math.sin(a0) * 96, Math.cos(a1) * 96, Math.sin(a1) * 96];
    return `M0 0 L${x0.toFixed(2)} ${y0.toFixed(2)} A96 96 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
  }

  protected labelPos(i: number): string {
    const a = ((i * 45 + 22.5 - 90) * Math.PI) / 180;
    return `translate(${(Math.cos(a) * 64).toFixed(1)} ${(Math.sin(a) * 64).toFixed(1)}) rotate(${i * 45 + 22.5})`;
  }

  protected async spin(): Promise<void> {
    if (this.spinning() || this.wallet.spunToday() || !this.online()) return;
    this.prize.set(null);
    const won = await this.wallet.spin();
    if (!won) return;
    this.spinning.set(true);
    const key = SLICE_KEY(won.kind, won.amount);
    const options = PRIZE_SLICES.map((v, i) => (v === key ? i : -1)).filter((i) => i >= 0);
    const slice = options[Math.floor(Math.random() * options.length)] ?? 0;
    this.rounds++;
    this.angle.set(360 * 6 * this.rounds + (360 - (slice * 45 + 22.5)));
    const ticker = setInterval(() => {
      this.haptics.tick();
      this.sound.tick();
    }, 200);
    setTimeout(() => {
      clearInterval(ticker);
      this.spinning.set(false);
      this.prize.set(won.kind === 'coins' ? `+${won.amount} 🪙` : `+${won.amount} 💡 hint${won.amount > 1 ? 's' : ''}`);
      this.haptics.success();
      this.wallet.land(won);
    }, 4200);
  }

  protected swatch(item: StoreItem): string {
    return SWATCH[item.id] ?? '#888';
  }

  protected owned(item: StoreItem): boolean {
    return item.kind !== 'hints' && this.wallet.owned().has(item.id);
  }

  protected unlockNote(item: StoreItem): string | null {
    const u = STREAK_UNLOCKS.find((x) => x.item === item.id);
    return u && !this.owned(item) ? `or free at a ${u.days}-day streak` : null;
  }

  protected using(item: StoreItem): boolean {
    const [kind, id] = item.id.split(':');
    return kind === 'accent' ? this.prefs.accent() === id : this.prefs.skin() === id;
  }

  protected use(item: StoreItem): void {
    const [kind, id] = item.id.split(':');
    if (kind === 'accent') this.prefs.setAccent(this.using(item) ? 'default' : id);
    else this.prefs.setSkin(this.using(item) ? 'none' : id);
  }

  protected async buy(item: StoreItem): Promise<void> {
    if (this.busy()) return;
    this.busy.set(item.id);
    const r = await this.wallet.buy(item);
    this.busy.set(null);
    this.say(r.ok ? `${item.name} is yours!` : (r.message ?? 'Could not buy that.'));
    if (r.ok && item.kind !== 'hints') this.use(item);
  }

  protected say(text: string): void {
    this.toast.set(text);
    setTimeout(() => this.toast.set(null), 2600);
  }

  protected readonly freeAccents = FREE_ACCENTS;
}
