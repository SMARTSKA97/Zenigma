import { ChallengesService } from './features/challenges/challenges.service';
import { HapticsService } from './core/haptics.service';
import { Component, computed, effect, inject, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from './core/auth.service';
import { BackService } from './core/back.service';
import { HintsService } from './core/hints.service';
import { HintsSyncService } from './core/hints-sync.service';
import { CoinBurst } from './shared/coin-burst';
import { WalletService } from './core/wallet.service';
import { MindSyncService } from './core/mind-sync.service';
import { SyncService } from './core/sync.service';
import { ConnectionService } from './core/connection.service';
import { ServerNotice } from './shared/server-notice';
import { NotificationPrompt } from './shared/notification-prompt';
import { ReminderService } from './core/reminder.service';
import { UpdaterService } from './core/updater.service';
import { Loader } from './shared/loader';
import { UpdateSheet } from './shared/update-sheet';
import { Sheet } from './shared/sheet';
import { UpiPay } from './shared/upi-pay';
import { IosGuide } from './shared/ios-guide';
import { InstallService } from './core/install.service';
import { PwaUpdate } from './shared/pwa-update';
import { PwaUpdateService } from './core/pwa-update.service';
import { WhatsNew } from './shared/whats-new';
import { SupportService } from './core/support.service';
import { SupportSheet } from './shared/support-sheet';
import { SupportNudge } from './shared/support-nudge';

@Component({
  selector: 'app-root',
  imports: [CoinBurst, RouterOutlet, RouterLink, RouterLinkActive, Loader, UpdateSheet, PwaUpdate, IosGuide, Sheet, UpiPay, WhatsNew, SupportSheet, SupportNudge, ServerNotice, NotificationPrompt],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly sync = inject(SyncService);
  protected readonly support = inject(SupportService);
  protected readonly conn = inject(ConnectionService);
  protected readonly auth = inject(AuthService);
  protected readonly back = inject(BackService);
  private readonly router = inject(Router);
  private readonly updater = inject(UpdaterService);
  protected readonly install = inject(InstallService);
  private readonly pwaUpdate = inject(PwaUpdateService);
  private readonly reminder = inject(ReminderService);
  protected readonly wallet = inject(WalletService);
  protected readonly hints = inject(HintsService);
  protected readonly goals = inject(ChallengesService);

  private readonly haptics = inject(HapticsService);

  constructor() {
    // Every card, tab and button gives a small tick when pressed. Games and boards buzz for themselves, so they are left out.
    document.addEventListener(
      'pointerdown',
      (e) => {
        const el = e.target as HTMLElement | null;
        if (!el?.closest('a, button, [role="button"]') || el.closest('app-play-screen, .board, .keyboard, [class*="board"], app-sheet')) return;
        this.haptics.tick();
      },
      { passive: true },
    );
    this.back.listen();
    inject(HintsService).visit();
    inject(HintsSyncService);
    inject(MindSyncService);
    void this.reminder.restore();
    // Android: look for a new version when the app opens (the update sheet appears only if there is one).
    this.updater.startAutoCheck();
  }
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  /** Practice is also where Mind lives. */
  protected readonly onPractice = computed(() => /^\/(practice|mind)(\/|\?|$)/.test(this.url()));
  /** Practice, speed rounds and mind games never need the server, so their screens hold the connection shut. */
  private readonly practising = computed(() => /^\/(games|speed|mind)\/[^/?]+/.test(this.url()) && !/\/levels(\?|$)/.test(this.url()));
  private release?: () => void;
  private readonly holdEffect = effect(() => {
    const on = this.practising();
    untracked(() => {
      this.release?.();
      this.release = on ? this.conn.hold() : undefined;
    });
  });
  protected readonly immersive = computed(() => /^\/(games|daily)\/[^/?]+/.test(this.url()));

  /** True while a screen is loading, so slow connections never look frozen. */
  protected readonly navigating = toSignal(
    this.router.events.pipe(
      filter(
        (e) => e instanceof NavigationStart || e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError,
      ),
      map((e) => e instanceof NavigationStart),
    ),
    { initialValue: false },
  );
}
