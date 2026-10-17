import { HttpErrorResponse } from '@angular/common/http';
import { afterNextRender, Component, computed, effect, ElementRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ConnectionService } from '../../core/connection.service';
import { GoogleService } from '../../core/google.service';
import { AGE_GROUPS, GENDERS, ProfilePatch, ProfileService } from '../../core/profile.service';
import { SyncService } from '../../core/sync.service';
import { Loader } from '../../shared/loader';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { Switch } from '../../shared/switch';

/** Sign in or create an account (email or Google), and once signed in: your profile, how you sign in, and what Zenigma may use. */
@Component({
  selector: 'app-account',
  imports: [Loader, Segmented, RouterLink, Switch],
  templateUrl: './account.html',
  styleUrl: './account.scss',
})
export class Account implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly sync = inject(SyncService);
  protected readonly conn = inject(ConnectionService);
  protected readonly profileApi = inject(ProfileService);
  private readonly google = inject(GoogleService);

  protected readonly profile = this.profileApi.profile;
  protected readonly ageGroups = AGE_GROUPS;
  protected readonly genders = GENDERS;

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

  /** Google's button is drawn into these (sign-in form, and the connect row in the profile). */
  private readonly signInSlot = viewChild<ElementRef<HTMLElement>>('googleSignIn');
  private readonly linkSlot = viewChild<ElementRef<HTMLElement>>('googleLink');
  protected readonly googleOffered = signal<boolean | null>(null);
  /** Whether the server can send email; null until it answers. */
  protected readonly emailOffered = signal<boolean | null>(null);

  // Forgot password: ask for a code, then enter it with a new password.
  protected readonly forgot = signal<'off' | 'ask' | 'code'>('off');
  protected readonly code = signal('');
  protected readonly resetPassword = signal('');

  // Confirming the address of a signed-in account.
  protected readonly verifying = signal<'off' | 'sent'>('off');
  protected readonly verifyCode = signal('');
  protected readonly verifyError = signal<string | null>(null);
  protected readonly googleNative = this.google.native;

  // Profile editing.
  protected readonly nameDraft = signal('');
  protected readonly saving = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly nameChanged = computed(() => this.nameDraft().trim() !== (this.profile()?.displayName ?? ''));
  protected readonly passwordOpen = signal(false);
  protected readonly currentPassword = signal('');
  protected readonly newPassword = signal('');
  protected readonly passwordError = signal<string | null>(null);

  protected readonly deletePassword = signal('');
  protected readonly deleteError = signal<string | null>(null);
  protected readonly deleting = signal(false);

  constructor() {
    // Draw Google's button as soon as its slot exists (the sign-in form, or the connect row for a signed-in player).
    effect(() => {
      const slot = this.signInSlot() ?? this.linkSlot();
      if (!slot) return;
      const linking = !!this.linkSlot();
      void this.google
        .renderButton(slot.nativeElement, (token) => void this.onGoogle(token, linking), linking ? 'continue_with' : this.mode() === 'register' ? 'signup_with' : 'signin_with')
        .then((shown) => this.googleOffered.set(shown));
    });
    afterNextRender(() => {
      void this.google.available().then((id) => this.googleOffered.set(id !== null));
      void this.google.emailAvailable().then((on) => this.emailOffered.set(on));
    });
  }

  ngOnInit(): void {
    void this.profileApi.load().then(() => this.nameDraft.set(this.profile()?.displayName ?? ''));
  }

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
      this.afterSignIn();
    } catch (error) {
      this.error.set(this.message(error));
    } finally {
      this.busy.set(false);
    }
  }

  protected startForgot(): void {
    this.error.set(null);
    this.code.set('');
    this.resetPassword.set('');
    this.forgot.set('ask');
  }

  protected leaveForgot(): void {
    this.error.set(null);
    this.forgot.set('off');
  }

  protected async sendResetCode(event: Event): Promise<void> {
    event.preventDefault();
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.forgotPassword(this.email().trim());
      this.forgot.set('code');
    } catch (error) {
      this.error.set(this.message(error));
    } finally {
      this.busy.set(false);
    }
  }

  protected async submitReset(event: Event): Promise<void> {
    event.preventDefault();
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.resetPassword(this.email().trim(), this.code().trim(), this.resetPassword());
      this.code.set('');
      this.resetPassword.set('');
      this.forgot.set('off');
      this.afterSignIn();
    } catch (error) {
      this.error.set(this.message(error));
    } finally {
      this.busy.set(false);
    }
  }

  protected async sendVerification(): Promise<void> {
    this.verifyError.set(null);
    this.saving.set(true);
    try {
      await this.auth.sendVerification();
      this.verifying.set('sent');
    } catch (error) {
      this.verifyError.set(this.message(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected async confirmEmail(event: Event): Promise<void> {
    event.preventDefault();
    this.verifyError.set(null);
    this.saving.set(true);
    try {
      await this.auth.verifyEmail(this.verifyCode().trim());
      this.verifyCode.set('');
      this.verifying.set('off');
      this.notice.set('Email confirmed.');
    } catch (error) {
      this.verifyError.set(this.message(error));
    } finally {
      this.saving.set(false);
    }
  }

  private afterSignIn(): void {
    void this.sync.refreshLocal().then(() => this.sync.sync());
    void this.profileApi.load().then(() => this.nameDraft.set(this.profile()?.displayName ?? ''));
  }

  /** Android: the phone's own Google account picker instead of Google's web button. */
  protected async nativeGoogle(linking: boolean): Promise<void> {
    this.error.set(null);
    this.notice.set(null);
    try {
      const token = await this.google.signInNative();
      if (token) await this.onGoogle(token, linking);
    } catch (error) {
      (linking ? this.notice : this.error).set(error instanceof Error ? error.message : this.message(error));
    }
  }

  private async onGoogle(token: string, linking: boolean): Promise<void> {
    this.error.set(null);
    this.notice.set(null);
    try {
      if (linking) {
        await this.profileApi.linkGoogle(token);
        this.notice.set('Google is connected. You can sign in with it from now on.');
      } else {
        await this.auth.loginWithGoogle(token);
        this.afterSignIn();
      }
    } catch (error) {
      (linking ? this.notice : this.error).set(this.message(error));
    }
  }

  protected async saveName(): Promise<void> {
    await this.run(() => this.profileApi.save({ displayName: this.nameDraft().trim() }), 'Name saved.');
  }

  protected async setAge(group: string | null): Promise<void> {
    const patch: ProfilePatch = group ? { ageGroup: group } : { clearAgeGroup: true };
    await this.run(() => this.profileApi.save(patch));
  }

  protected async setGender(gender: string | null): Promise<void> {
    const patch: ProfilePatch = gender ? { gender } : { clearGender: true };
    await this.run(() => this.profileApi.save(patch));
  }

  protected async setShareName(show: boolean): Promise<void> {
    await this.run(() => this.profileApi.save({ hideName: !show }));
  }

  protected async setShareCohort(on: boolean): Promise<void> {
    await this.run(() => this.profileApi.save({ shareCohort: on }));
  }

  protected async disconnectGoogle(): Promise<void> {
    await this.run(() => this.profileApi.unlinkGoogle(), 'Google is disconnected.');
  }

  protected async savePassword(event: Event): Promise<void> {
    event.preventDefault();
    this.passwordError.set(null);
    this.saving.set(true);
    try {
      await this.profileApi.setPassword(this.profile()?.hasPassword ? this.currentPassword() : null, this.newPassword());
      this.currentPassword.set('');
      this.newPassword.set('');
      this.passwordOpen.set(false);
      this.notice.set('Password saved.');
    } catch (error) {
      this.passwordError.set(this.message(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected async deleteAccount(event: Event): Promise<void> {
    event.preventDefault();
    this.deleting.set(true);
    this.deleteError.set(null);
    try {
      await this.auth.deleteAccount(this.profile()?.hasPassword === false ? null : this.deletePassword());
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
      this.profileApi.profile.set(null);
    } finally {
      this.signingOut.set(false);
    }
  }

  private async run(action: () => Promise<void>, done?: string): Promise<void> {
    this.saving.set(true);
    this.notice.set(null);
    try {
      await action();
      if (done) this.notice.set(done);
    } catch (error) {
      this.notice.set(this.message(error));
    } finally {
      this.saving.set(false);
    }
  }

  private message(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) return this.conn.offlineMode() ? 'Offline mode is on. Turn it off in Settings to use your account.' : 'Cannot reach the server. You can keep playing offline and try again later.';
      const detail = error.error as { detail?: string; title?: string; errors?: Record<string, string[]> } | null;
      const first = detail?.errors ? Object.values(detail.errors)[0]?.[0] : undefined;
      return first ?? detail?.detail ?? detail?.title ?? `Request failed (${error.status})`;
    }
    return 'Something went wrong';
  }
}
