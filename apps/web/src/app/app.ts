import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';
import { SyncService } from './core/sync.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <header>
      <a class="brand" routerLink="/">Zenigma</a>
      <nav>
        <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Home</a>
        <a routerLink="/sync-test" routerLinkActive="active">Sync test</a>
        <a routerLink="/account" routerLinkActive="active">Account</a>
        <a routerLink="/settings" routerLinkActive="active">Settings</a>
      </nav>
      <div class="status" aria-live="polite">
        <span class="pill" [class.good]="sync.online()" [class.bad]="!sync.online()">
          {{ sync.online() ? 'Online' : 'Offline' }}
        </span>
        <span class="pill">{{ auth.signedIn() ? 'Signed in' : 'Guest' }}</span>
        @if (sync.pendingCount() > 0) {
          <span class="pill warn">{{ sync.pendingCount() }} to sync</span>
        }
      </div>
    </header>
    <main>
      <router-outlet />
    </main>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100dvh;
    }
    header {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      align-items: center;
      gap: 1.5rem;
      padding: calc(0.6rem + env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) 0.6rem
        max(1rem, env(safe-area-inset-left));
      background: color-mix(in srgb, var(--surface) 82%, transparent);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
    }
    .brand {
      font-weight: 700;
      font-size: 1.2rem;
      text-decoration: none;
      color: var(--text);
      letter-spacing: -0.02em;
    }
    nav {
      display: flex;
      gap: 0.25rem;
      flex: 1;
    }
    nav a {
      text-decoration: none;
      color: var(--muted);
      padding: 0.4rem 0.8rem;
      border-radius: 999px;
      transition:
        color 0.2s var(--ease),
        background-color 0.2s var(--ease);
    }
    nav a:hover {
      color: var(--text);
    }
    nav a.active {
      color: var(--text);
      background: var(--border);
      font-weight: 600;
    }
    .status {
      display: flex;
      gap: 0.4rem;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .pill {
      font-size: 0.75rem;
      padding: 0.15rem 0.6rem;
      border-radius: 999px;
      border: 1px solid var(--border);
      color: var(--muted);
      white-space: nowrap;
      animation: rise 0.25s var(--ease) backwards;
    }
    .pill.good {
      color: var(--good);
    }
    .pill.bad {
      color: var(--bad);
      border-color: var(--bad);
    }
    .pill.warn {
      color: var(--warn);
      border-color: var(--warn);
    }
    main {
      max-width: 56rem;
      margin: 0 auto;
      padding: 1.5rem max(1rem, env(safe-area-inset-right)) 3rem max(1rem, env(safe-area-inset-left));
    }

    /* Phones: brand + status on top, navigation as a bottom tab bar within thumb reach. */
    @media (max-width: 640px) {
      header {
        justify-content: space-between;
        gap: 0.5rem;
        /* backdrop-filter would make the header the containing block of the fixed tab bar. */
        backdrop-filter: none;
        background: var(--surface);
      }
      nav {
        position: fixed;
        inset: auto 0 0 0;
        z-index: 10;
        justify-content: space-around;
        gap: 0;
        padding: 0.35rem 0.5rem calc(0.35rem + env(safe-area-inset-bottom));
        background: color-mix(in srgb, var(--surface) 88%, transparent);
        backdrop-filter: blur(12px);
        border-top: 1px solid var(--border);
      }
      nav a {
        flex: 1;
        text-align: center;
        font-size: 0.8rem;
        padding: 0.6rem 0.25rem;
        min-height: 44px;
      }
      main {
        padding-bottom: calc(5.5rem + env(safe-area-inset-bottom));
      }
    }
  `,
})
export class App {
  protected readonly sync = inject(SyncService);
  protected readonly auth = inject(AuthService);
}
