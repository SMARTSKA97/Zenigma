import { ACCENTS, Cosmetic, SKINS, WalletService } from '../../core/wallet.service';
import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, DestroyRef, effect, inject, OnInit, signal } from '@angular/core';
import { SupportService } from '../../core/support.service';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
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

/** Matches the stylesheet: a tablet or desktop, or a phone held on its side. */
const WIDE = '(min-width: 768px), (min-width: 600px) and (orientation: landscape)';

const TITLES: Record<string, string> = {
  connection: 'Connection',
  theme: 'Theme and colour',
  play: 'Play and display',
  feedback: 'Sound and vibration',
  reminders: 'Reminders',
  updates: 'App updates',
  install: 'Install',
  data: 'Your data',
};

@Component({
  selector: 'app-settings',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, NgTemplateOutlet, Loader, Segmented, Switch],
  host: { '[class.wide]': 'wide()' },
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
  /** The section that is open (one at a time, like an accordion) on a phone; the chosen section beside the list on a wide screen. */
  protected readonly open = signal<string | null>(null);
  protected toggle(key: string): void {
    this.open.update((k) => (k === key ? null : key));
  }

  /** Wide screens (a tablet, a desktop, or a phone on its side): a list of sections with the chosen one beside it. */
  private readonly query = typeof matchMedia === 'function' ? matchMedia(WIDE) : null;
  protected readonly wide = signal(this.query?.matches ?? false);
  private readonly url = signal(this.router.url);
  /** The page shown in the right pane (Stats, About and so on); null while a section of this page is shown. */
  protected readonly child = computed(() => (this.wide() && /^\/settings\/[^/?#]+/.test(this.url()) ? this.url().split(/[?#]/)[0] : null));
  /** The chosen entry in the list. */
  protected readonly cur = computed(() => this.child() ?? this.open() ?? 'connection');
  protected readonly title = computed(() => TITLES[this.cur()] ?? '');

  /** A link inside a page shown beside the list (More from About, a game's rules...) opens in that pane too, not on a new page. */
  protected keepInPane(event: MouseEvent): void {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const link = (event.target as HTMLElement).closest('a[href]');
    const href = link?.getAttribute('href') ?? '';
    const m = /^\/(account|stats|badges|rules|changelog|about|contributors|privacy|sync-test)(\/[^?#]+)?$/.exec(href);
    if (!m) return;
    event.preventDefault();
    void this.router.navigateByUrl(`/settings/${m[1]}${m[2] ?? ''}`);
  }

  protected select(key: string): void {
    this.open.set(key);
    if (this.child()) void this.router.navigate(['/settings']);
  }

  private readonly follow = (() => {
    const destroyRef = inject(DestroyRef);
    const onChange = () => this.wide.set(this.query?.matches ?? false);
    this.query?.addEventListener('change', onChange);
    const sub = this.router.events.subscribe((e) => e instanceof NavigationEnd && this.url.set(e.urlAfterRedirects));
    destroyRef.onDestroy(() => {
      this.query?.removeEventListener('change', onChange);
      sub.unsubscribe();
    });
    // A page opened beside the list means nothing on a narrow screen: go back to the plain list.
    effect(() => {
      if (!this.wide() && /^\/settings\/[^/?#]+/.test(this.url())) void this.router.navigate(['/settings']);
    });
  })();

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
