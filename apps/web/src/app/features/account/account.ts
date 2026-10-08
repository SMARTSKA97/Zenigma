import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { SyncService } from '../../core/sync.service';

@Component({
  selector: 'app-account',
  template: `
    <h1>Account</h1>

    @if (auth.user(); as user) {
      <div class="card">
        <p>
          Signed in as <strong>{{ user.displayName || user.email }}</strong>
          @if (user.displayName) {
            <span class="muted">({{ user.email }})</span>
          }
        </p>
        <button class="secondary" (click)="signOut()">Sign out</button>
        @if (sync.pendingCount() > 0) {
          <p class="error">Signing out deletes {{ sync.pendingCount() }} item(s) that have not synced yet.</p>
        }
      </div>
    } @else {
      @if (auth.sessionExpired()) {
        <p class="card">Your session has ended. Sign in again; nothing on this device was lost.</p>
      }
      <p class="muted">Guest mode works fully offline. Create an account to sync your history across devices.</p>

      <form class="card form" (submit)="submit($event)">
        <div class="row">
          <button type="button" [class.secondary]="mode() !== 'signin'" (click)="mode.set('signin')">Sign in</button>
          <button type="button" [class.secondary]="mode() !== 'register'" (click)="mode.set('register')">Create account</button>
        </div>
        @if (mode() === 'register') {
          <label>
            Display name
            <input name="displayName" autocomplete="nickname" [value]="displayName()" (input)="displayName.set($any($event.target).value)" />
          </label>
        }
        <label>
          Email
          <input name="email" type="email" autocomplete="email" required [value]="email()" (input)="email.set($any($event.target).value)" />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            required
            minlength="8"
            [attr.autocomplete]="mode() === 'register' ? 'new-password' : 'current-password'"
            [value]="password()"
            (input)="password.set($any($event.target).value)"
          />
        </label>
        @if (error(); as message) {
          <p class="error">{{ message }}</p>
        }
        <button type="submit" [disabled]="busy()">{{ mode() === 'register' ? 'Create account' : 'Sign in' }}</button>
      </form>
    }
  `,
  styles: `
    .form {
      display: grid;
      gap: 1rem;
      max-width: 24rem;
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
    await this.auth.logout();
    await this.sync.refreshLocal();
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
