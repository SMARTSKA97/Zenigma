import { ACCENTS, Cosmetic, SKINS, WalletService } from '../../core/wallet.service';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { SupportService } from '../../core/support.service';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ConnectionService } from '../../core/connection.service';
import { SyncService } from '../../core/sync.service';
import { ReminderService } from '../../core/reminder.service';
import { Loader } from '../../shared/loader';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { Switch } from '../../shared/switch';
import { InstallService } from '../../core/install.service';
import { HapticStrength, PrefsService } from '../../core/prefs.service';
import { ThemeMode, ThemeService } from '../../core/theme.service';
import { environment } from '../../../environments/environment';
import { UpdaterService } from '../../core/updater.service';

@Component({
  selector: 'app-settings',
  imports: [RouterLink, Loader, Segmented, Switch],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings implements OnInit {
  protected readonly theme = inject(ThemeService);
  protected readonly updater = inject(UpdaterService);
  protected readonly version = this.updater.currentVersion;
  protected readonly prefs = inject(PrefsService);
  protected readonly auth = inject(AuthService);
  protected readonly sync = inject(SyncService);
  protected readonly conn = inject(ConnectionService);
  protected readonly reminder = inject(ReminderService);
  protected readonly install = inject(InstallService);
  protected readonly support = inject(SupportService);
  protected readonly canDonate = this.support.canDonate;
  protected readonly wallet = inject(WalletService);
  /** The thank-you colour and look show to supporters, and to anyone who could become one. */
  private readonly visible = (list: Cosmetic[]) => list.filter((c) => !c.supporter || this.canDonate() || (c.item && this.wallet.owned().has(c.item)));
  protected readonly accents = computed(() => this.visible(ACCENTS));
  protected readonly skins = computed(() => this.visible(SKINS));
  private readonly router = inject(Router);
  /** The section that is open (one at a time, like an accordion). */
  protected readonly open = signal<string | null>(typeof matchMedia === 'function' && matchMedia('(min-width: 768px)').matches ? 'appearance' : null);
  protected toggle(key: string): void {
    // On a wide screen the sections are a list with the chosen one beside it, so one always stays chosen.
    this.open.update((k) => (k === key && !this.wide() ? null : key));
  }

  /** True on a tablet or desktop, where Settings is a list with the detail beside it. */
  private readonly wide = () => typeof matchMedia === 'function' && matchMedia('(min-width: 768px)').matches;
  protected readonly tier = this.wallet.supporterTier;

  /** A colour or theme is free, owned, or locked (then it opens the store). */
  protected pick(kind: 'accent' | 'skin', entry: { id: string; item?: string }): void {
    if (entry.item && !this.wallet.owned().has(entry.item)) {
      if ((entry as { supporter?: boolean }).supporter) this.support.open.set(true);
      else void this.router.navigateByUrl('/store');
      return;
    }
    if (kind === 'accent') this.prefs.setAccent(entry.id);
    else this.prefs.setSkin(entry.id);
  }

  protected locked(entry: { item?: string }): boolean {
    return !!entry.item && !this.wallet.owned().has(entry.item);
  }
  protected readonly strengths: SegmentOption<HapticStrength>[] = [
    { value: 'off', label: 'Off' },
    { value: 'light', label: 'Light' },
    { value: 'strong', label: 'Strong' },
  ];
  protected readonly themes: SegmentOption<ThemeMode>[] = [
    { value: 'system', label: 'System' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ];

  /** Everything Zenigma keeps on this device, as one JSON file. Sign-in tokens are left out. */
  protected exportData(): void {
    const data: Record<string, unknown> = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith('zenigma.') || /token|auth|jwt|secret|password/i.test(key)) continue;
        const raw = localStorage.getItem(key) ?? '';
        try {
          data[key] = JSON.parse(raw);
        } catch {
          data[key] = raw;
        }
      }
    } catch {
      /* no storage: an empty export */
    }
    const blob = new Blob([JSON.stringify({ app: 'Zenigma', exportedAt: new Date().toISOString(), data }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zenigma-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  ngOnInit(): void {
    void this.updater.loadVersion();
  }
}
