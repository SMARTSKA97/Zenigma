import { Component, computed, inject } from '@angular/core';
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
import { SyncService } from './core/sync.service';
import { Loader } from './shared/loader';
import { UpdateSheet } from './shared/update-sheet';
import { WhatsNew } from './shared/whats-new';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Loader, UpdateSheet, WhatsNew],
  template: `
    <div class="progress" [class.on]="navigating()" aria-hidden="true"><span></span></div>

    <header [class.hide-on-phone]="immersive()">
      <a class="brand" routerLink="/" aria-label="Zenigma home">
        <app-loader [size]="26" [animate]="false" />
        <span>Zenigma</span>
      </a>

      <nav aria-label="Main">
        <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ paths: 'exact', queryParams: 'ignored', fragment: 'ignored', matrixParams: 'ignored' }">
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="2" /><rect x="13.5" y="3.5" width="7" height="7" rx="2" /><rect x="3.5" y="13.5" width="7" height="7" rx="2" /><rect x="13.5" y="13.5" width="7" height="7" rx="2" /></svg>
          <span>Games</span>
        </a>
        <a routerLink="/daily" routerLinkActive="active" [routerLinkActiveOptions]="{ paths: 'exact', queryParams: 'ignored', fragment: 'ignored', matrixParams: 'ignored' }">
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M8 3v4M16 3v4M3.5 10h17" /><path d="M9 15l2 2 4-4" /></svg>
          <span>Daily</span>
        </a>
        <a routerLink="/ranks" routerLinkActive="active">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 20v-8M12 20V4M17 20v-5" /></svg>
          <span>Ranks</span>
        </a>
        <a routerLink="/account" routerLinkActive="active">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.5" r="3.75" /><path d="M4.5 20c.9-3.6 3.8-5.5 7.5-5.5s6.6 1.9 7.5 5.5" /></svg>
          <span>Account</span>
        </a>
        <a routerLink="/settings" routerLinkActive="active">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2.25" /><circle cx="9" cy="17" r="2.25" /></svg>
          <span>Settings</span>
        </a>
      </nav>

      <div class="status" aria-live="polite">
        @if (sync.syncing()) {
          <app-loader [size]="14" />
          <span>Syncing</span>
        } @else if (!sync.online()) {
          <i class="dot bad"></i>
          <span>Offline</span>
        } @else if (sync.pendingCount() > 0) {
          <i class="dot warn"></i>
          <span>{{ sync.pendingCount() }} to sync</span>
        } @else {
          <i class="dot good"></i>
          <span class="quiet">{{ auth.signedIn() ? 'Synced' : 'Guest' }}</span>
        }
      </div>
    </header>

    <main [class.immersive]="immersive()">
      <router-outlet />
    </main>

    <app-update-sheet />
    <app-whats-new />
  `,
  styles: `
    :host {
      display: block;
      min-height: 100dvh;
    }

    .progress {
      position: fixed;
      inset: 0 0 auto 0;
      z-index: 50;
      height: 3px;
      overflow: hidden;
      opacity: 0;
      transition: opacity 0.2s var(--ease);
      pointer-events: none;
    }
    .progress.on {
      opacity: 1;
      transition-delay: 0.15s; /* quick navigations never flash the bar */
    }
    .progress span {
      display: block;
      width: 40%;
      height: 100%;
      background: var(--accent);
      border-radius: 99px;
      animation: slide 1s var(--ease) infinite;
    }
    @keyframes slide {
      from {
        transform: translateX(-100%);
      }
      to {
        transform: translateX(260%);
      }
    }

    header {
      position: sticky;
      top: 0;
      z-index: 10;
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: 1rem;
      padding: calc(0.75rem + env(safe-area-inset-top)) max(1.25rem, env(safe-area-inset-right)) 0.75rem
        max(1.25rem, env(safe-area-inset-left));
      background: color-mix(in srgb, var(--bg) 80%, transparent);
      backdrop-filter: blur(16px) saturate(1.4);
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 0.6rem;
      width: max-content;
      color: var(--text);
      text-decoration: none;
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 1.25rem;
      letter-spacing: -0.03em;
    }
    nav {
      display: flex;
      gap: 0.25rem;
      padding: 4px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 999px;
      box-shadow: var(--shadow);
    }
    nav a {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.45rem 1rem;
      border-radius: 999px;
      color: var(--muted);
      font-size: 0.925rem;
      font-weight: 550;
      text-decoration: none;
      transition:
        color 0.2s var(--ease),
        background-color 0.25s var(--ease);
    }
    nav a svg {
      display: none;
      width: 22px;
      height: 22px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    nav a:hover {
      color: var(--text);
    }
    nav a.active {
      color: var(--ink-contrast);
      background: var(--ink);
    }
    .status {
      justify-self: end;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.8125rem;
      color: var(--muted);
      white-space: nowrap;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--muted);
    }
    .dot.good {
      background: var(--good);
    }
    .dot.bad {
      background: var(--bad);
    }
    .dot.warn {
      background: var(--warn);
    }

    main {
      max-width: 62rem;
      margin: 0 auto;
      padding: 1rem max(1.25rem, env(safe-area-inset-right)) 4rem max(1.25rem, env(safe-area-inset-left));
    }

    /* Phones: brand and status on top, navigation as a floating tab bar within thumb reach. */
    @media (max-width: 720px) {
      header {
        grid-template-columns: 1fr auto;
        /* backdrop-filter would make the header the containing block of the fixed tab bar. */
        backdrop-filter: none;
        background: var(--bg);
      }
      nav {
        position: fixed;
        z-index: 10;
        inset: auto max(1rem, env(safe-area-inset-left)) calc(0.75rem + env(safe-area-inset-bottom))
          max(1rem, env(safe-area-inset-right));
        justify-content: space-around;
        gap: 0;
        background: color-mix(in srgb, var(--surface) 92%, transparent);
        backdrop-filter: blur(16px);
        box-shadow: var(--shadow-lift);
      }
      nav a {
        flex: 1;
        flex-direction: column;
        gap: 0.1rem;
        padding: 0.5rem 0.25rem 0.4rem;
        font-size: 0.72rem;
        min-height: 54px;
        justify-content: center;
      }
      nav a svg {
        display: block;
      }
      main {
        padding-top: 0.5rem;
        padding-bottom: calc(6.5rem + env(safe-area-inset-bottom));
      }
      /* Game screens take the whole screen; their own back arrow replaces the header and tab bar. */
      /* Android: a Material 3 navigation bar, flush with the bottom edge and a pill behind the active icon. */
      :host-context([data-platform='android']) nav {
        inset: auto 0 0 0;
        padding: 0.75rem 0.5rem calc(0.75rem + env(safe-area-inset-bottom));
        border: 0;
        border-radius: 0;
        background: var(--surface-2);
        backdrop-filter: none;
        box-shadow: none;
      }
      :host-context([data-platform='android']) nav a {
        min-height: 0;
        padding: 0;
        gap: 0.25rem;
        color: var(--muted);
        font-weight: 500;
        background: transparent;
      }
      :host-context([data-platform='android']) nav a svg {
        width: 64px;
        height: 32px;
        padding: 4px 20px;
        border-radius: 16px;
        transition:
          background-color 0.3s var(--ease),
          color 0.3s var(--ease);
      }
      :host-context([data-platform='android']) nav a.active {
        color: var(--text);
        background: transparent;
        font-weight: 700;
      }
      :host-context([data-platform='android']) nav a.active svg {
        background: var(--accent-soft);
        color: var(--accent);
      }
      :host-context([data-platform='android']) main {
        padding-bottom: calc(6rem + env(safe-area-inset-bottom));
      }
      header.hide-on-phone {
        display: none;
      }
      header.hide-on-phone ~ main.immersive {
        padding-top: calc(0.75rem + env(safe-area-inset-top));
        padding-bottom: calc(1rem + env(safe-area-inset-bottom));
      }
    }
  `,
})
export class App {
  protected readonly sync = inject(SyncService);
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
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
