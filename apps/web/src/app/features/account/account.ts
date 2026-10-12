import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { SyncService } from '../../core/sync.service';
import { RouterLink } from '@angular/router';
import { Loader } from '../../shared/loader';
import { Segmented, SegmentOption } from '../../shared/segmented';

@Component({
  selector: 'app-account',
  imports: [Loader, Segmented, RouterLink],
  template: `
    @if (auth.user(); as user) {
      <section class="profile">
        <div class="avatar" aria-hidden="true">{{ initial(user) }}</div>
        <h1>{{ user.displayName || user.email }}</h1>
        @if (user.displayName) {
          <p class="muted">{{ user.email }}</p>
        }

        <div class="card stats">
          <div>
            <span class="label">Sync</span>
            <strong>
              @if (sync.syncing()) {
                Syncing
              } @else if (sync.pendingCount() > 0) {
                {{ sync.pendingCount() }} waiting
              } @else {
                Up to date
              }
            </strong>
          </div>
          <div>
            <span class="label">Connection</span>
            <strong>{{ sync.online() ? 'Online' : 'Offline' }}</strong>
          </div>
        </div>

        <a class="button secondary stats-link" routerLink="/stats">Streaks and stats</a>

        @if (sync.pendingCount() > 0) {
          <p class="error warning">Signing out deletes {{ sync.pendingCount() }} item(s) that have not synced yet.</p>
        }
        <button type="button" class="secondary" [disabled]="signingOut()" (click)="signOut()">
          @if (signingOut()) {
            <app-loader [size]="16" />
          }
          Sign out
        </button>
      </section>
    } @else {
      <section class="auth">
        <app-loader class="mark" [size]="40" [animate]="busy()" />
        <h1>{{ mode() === 'register' ? 'Create your account' : 'Welcome back' }}</h1>
        <p class="muted lede">
          Guest mode works fully offline. An account keeps your streaks and history in sync across devices.
        </p>

        @if (auth.sessionExpired()) {
          <p class="notice">Your session has ended. Sign in again; nothing on this device was lost.</p>
        }

        <form class="card form" [class.busy]="busy()" (submit)="submit($event)">
          <app-segmented
            label="Sign in or create account"
            [options]="modes"
            [value]="mode()"
            (valueChange)="mode.set($event)"
          />

          @if (mode() === 'register') {
            <label>
              Display name
              <input name="displayName" autocomplete="nickname" [value]="displayName()" (input)="displayName.set($any($event.target).value)" />
            </label>
          }
          <label>
            Email
            <input name="email" type="email" inputmode="email" autocomplete="email" required [value]="email()" (input)="email.set($any($event.target).value)" />
          </label>
          <label>
            Password
            <span class="password">
              <input
                name="password"
                [type]="reveal() ? 'text' : 'password'"
                required
                minlength="8"
                [attr.autocomplete]="mode() === 'register' ? 'new-password' : 'current-password'"
                [value]="password()"
                (input)="password.set($any($event.target).value)"
              />
              <button type="button" class="reveal" (click)="reveal.set(!reveal())" [attr.aria-pressed]="reveal()">
                {{ reveal() ? 'Hide' : 'Show' }}
              </button>
            </span>
          </label>

          @if (error(); as message) {
            <p class="alert" role="alert">{{ message }}</p>
          }

          <button type="submit" class="submit" [disabled]="busy()">
            @if (busy()) {
              <app-loader [size]="18" />
              {{ mode() === 'register' ? 'Creating account' : 'Signing in' }}
            } @else {
              {{ mode() === 'register' ? 'Create account' : 'Sign in' }}
            }
          </button>
        </form>
      </section>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .auth,
    .profile {
      display: grid;
      justify-items: center;
      text-align: center;
      max-width: 26rem;
      margin: clamp(0rem, 4vh, 2.5rem) auto 0;
    }
    .mark {
      margin-bottom: 1.25rem;
    }
    .auth h1,
    .profile h1 {
      font-size: clamp(1.6rem, 1.2rem + 1.8vw, 2.1rem);
    }
    .lede {
      max-width: 34ch;
      margin-bottom: 1.5rem;
    }
    .notice {
      width: 100%;
      padding: 0.75rem 1rem;
      border-radius: var(--radius-sm);
      background: var(--accent-soft);
      color: var(--text);
      font-size: 0.9rem;
    }
    .form {
      width: 100%;
      display: grid;
      gap: 1rem;
      text-align: left;
      padding: 1.25rem;
      transition: opacity 0.25s var(--ease);
    }
    .form.busy {
      opacity: 0.7;
      pointer-events: none;
    }
    .password {
      position: relative;
      display: block;
    }
    .password input {
      width: 100%;
      padding-right: 4.5rem;
    }
    .reveal {
      position: absolute;
      top: 50%;
      right: 0.35rem;
      transform: translateY(-50%);
      min-height: 36px;
      padding: 0 0.8rem;
      border: 0;
      background: transparent;
      color: var(--muted);
      font-size: 0.85rem;
      box-shadow: none !important;
    }
    .reveal:active:not(:disabled) {
      transform: translateY(-50%) scale(0.95);
    }
    .alert {
      margin: 0;
      padding: 0.7rem 0.9rem;
      border-radius: var(--radius-sm);
      background: color-mix(in srgb, var(--bad) 12%, transparent);
      color: var(--bad);
      font-size: 0.9rem;
      animation: nudge 0.4s var(--ease);
    }
    @keyframes nudge {
      20%,
      60% {
        transform: translateX(-5px);
      }
      40%,
      80% {
        transform: translateX(5px);
      }
    }
    .submit {
      width: 100%;
      min-height: 52px;
    }

    .avatar {
      width: 5rem;
      height: 5rem;
      display: grid;
      place-items: center;
      margin-bottom: 1rem;
      border-radius: 50%;
      background: var(--ink);
      color: var(--ink-contrast);
      font-family: var(--font-display);
      font-size: 2rem;
      font-weight: 700;
      text-transform: uppercase;
      animation: rise 0.4s var(--spring) backwards;
    }
    .stats-link {
      margin-bottom: 1rem;
    }
    .stats {
      width: 100%;
      display: grid;
      grid-template-columns: 1fr 1fr;
      margin: 1.25rem 0;
      text-align: left;
    }
    .stats .label {
      display: block;
      color: var(--muted);
      font-size: 0.8rem;
    }
    .warning {
      margin-bottom: 1rem;
    }
  `,
})
export class Account {
  protected readonly auth = inject(AuthService);
  protected readonly sync = inject(SyncService);

  protected readonly mode = signal<'signin' | 'register'>('signin');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly displayName = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly reveal = signal(false);
  protected readonly signingOut = signal(false);
  protected readonly modes: SegmentOption<'signin' | 'register'>[] = [
    { value: 'signin', label: 'Sign in' },
    { value: 'register', label: 'Create account' },
  ];

  protected initial(user: { displayName?: string | null; email: string }): string {
    return (user.displayName || user.email).trim().charAt(0);
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    this.busy.set(true);
    this.error.set(null);
    try {
      if (this.mode() === 'register') {
        await this.auth.register(this.email().trim(), this.password(), this.displayName().trim());
      } else {
        await this.auth.login(this.email().trim(), this.password());
      }
      this.password.set('');
      void this.sync.refreshLocal().then(() => this.sync.sync());
    } catch (error) {
      this.error.set(this.message(error));
    } finally {
      this.busy.set(false);
    }
  }

  protected async signOut(): Promise<void> {
    this.signingOut.set(true);
    try {
      await this.auth.logout();
      await this.sync.refreshLocal();
    } finally {
      this.signingOut.set(false);
    }
  }

  private message(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) return 'Cannot reach the server. You can keep playing offline and sign in later.';
      const detail = error.error as { detail?: string; title?: string; errors?: Record<string, string[]> } | null;
      const first = detail?.errors ? Object.values(detail.errors)[0]?.[0] : undefined;
      return first ?? detail?.detail ?? detail?.title ?? `Request failed (${error.status})`;
    }
    return 'Something went wrong';
  }
}
