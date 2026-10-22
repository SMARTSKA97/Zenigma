import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { SupportService } from '../core/support.service';

/** "Already sent a tip?": a short form that tells the owner, who checks it and switches on the thank-you perks. */
@Component({
  selector: 'app-support-claim',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!open()) {
      <button type="button" class="link" (click)="open.set(true)">Already sent a tip? Tell me</button>
    } @else if (!auth.signedIn()) {
      <p class="muted">Sign in first, so your thank-you goes to your account.</p>
      <button type="button" (click)="signIn()">Sign in</button>
    } @else if (state() === 'sent') {
      <p class="ok">Thank you! I will check it and your badge and look will switch on soon, on every device you sign in on.</p>
    } @else {
      <form (ngSubmit)="send()">
        <label>Amount sent (₹)<input name="amount" type="number" inputmode="numeric" min="1" max="1000000" [(ngModel)]="amount" required /></label>
        <label>
          How
          <select name="method" [(ngModel)]="method">
            <option value="upi">UPI</option>
            <option value="github">GitHub Sponsors</option>
            <option value="coffee">Buy me a coffee</option>
            <option value="other">Something else</option>
          </select>
        </label>
        <label>Name for the thank-you list (optional)<input name="name" maxlength="40" [(ngModel)]="name" autocomplete="nickname" /></label>
        <button type="submit" [disabled]="busy() || !amount">{{ busy() ? 'Sending' : 'Send' }}</button>
        @if (state() === 'unavailable') {
          <p class="bad">Not available right now. Please try again later.</p>
        } @else if (state() === 'limit') {
          <p class="bad">That is enough for today. Thank you!</p>
        } @else if (state() === 'failed') {
          <p class="bad">Could not send that. Please try again.</p>
        }
      </form>
    }
  `,
  styles: `
    :host {
      display: block;
      margin-top: 1rem;
      text-align: center;
    }
    form {
      display: grid;
      gap: 0.6rem;
      text-align: left;
    }
    label {
      display: grid;
      gap: 0.25rem;
      font-size: 0.85rem;
      color: var(--muted);
    }
    .link {
      min-height: 0;
      padding: 0.3rem 0.6rem;
      border: 0;
      background: transparent;
      box-shadow: none;
      color: var(--accent);
      font-weight: 600;
    }
    .ok {
      color: var(--good);
      font-weight: 600;
    }
    .bad {
      color: var(--bad);
      margin: 0;
      font-size: 0.85rem;
    }
  `,
})
export class SupportClaim {
  protected readonly auth = inject(AuthService);
  private readonly support = inject(SupportService);
  private readonly router = inject(Router);
  readonly closeSheet = output<void>();
  protected readonly open = signal(false);
  protected readonly busy = signal(false);
  protected readonly state = signal<'idle' | 'sent' | 'unavailable' | 'limit' | 'failed'>('idle');
  protected amount: number | null = null;
  protected method = 'upi';
  protected name = '';

  protected signIn(): void {
    this.closeSheet.emit();
    void this.router.navigateByUrl('/account');
  }

  protected async send(): Promise<void> {
    if (!this.amount || this.busy()) return;
    this.busy.set(true);
    this.state.set(await this.support.claim(Math.round(this.amount), this.method, this.name));
    this.busy.set(false);
  }
}
