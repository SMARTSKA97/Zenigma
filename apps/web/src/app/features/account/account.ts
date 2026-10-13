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
  templateUrl: './account.html',
  styleUrl: './account.scss',
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

  protected readonly deletePassword = signal('');
  protected readonly deleteError = signal<string | null>(null);
  protected readonly deleting = signal(false);

  protected async deleteAccount(event: Event): Promise<void> {
    event.preventDefault();
    this.deleting.set(true);
    this.deleteError.set(null);
    try {
      await this.auth.deleteAccount(this.deletePassword());
      this.deletePassword.set('');
    } catch (error) {
      this.deleteError.set(
        error instanceof HttpErrorResponse && error.status === 403 ? 'That password is not right.' : 'Could not delete the account. Check your connection and try again.',
      );
    } finally {
      this.deleting.set(false);
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
