import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { SupportService } from '../core/support.service';

const CHIPS = [49, 99, 199, 499];

/**
 * Pay by UPI: pick an amount, then pay with an app (Android shows its chooser of every UPI app, iPhone gets a list) or scan a QR code with any
 * UPI app (computers, or a second phone). Coming back to Zenigma asks "did it go through?" and, on yes, tells the owner so the thank-you can be switched on.
 * A tip between two UPI IDs gives the app no receipt, so this is honest about it: the owner checks the payment before the perks switch on.
 */
@Component({
  selector: 'app-upi-pay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (state() === 'sent') {
      <div class="box ok">
        <strong>Thank you! 💚</strong>
        <p>I will check the payment and your badge and look switch on soon, on every device you sign in on.</p>
        <button type="button" class="ghost" (click)="done()">Close</button>
      </div>
    } @else if (s.pending()) {
      <div class="box">
        <strong>Did your {{ s.pending()?.amountInr ? '₹' + s.pending()?.amountInr : '' }} payment go through?</strong>
        @if (!auth.signedIn()) {
          <p>Sign in so your thank-you goes to your account, then come back and tap yes.</p>
          <div class="row">
            <button type="button" (click)="signIn()">Sign in</button>
            <button type="button" class="ghost" (click)="notYet()">Not yet</button>
          </div>
        } @else {
          <p>Your UPI app has the receipt. Tell me and I will check it on my side.</p>
          <div class="row">
            <button type="button" [disabled]="busy()" (click)="yes()">{{ busy() ? 'Sending' : 'Yes, it did' }}</button>
            <button type="button" class="ghost" (click)="notYet()">No, not yet</button>
          </div>
        }
        @if (state() === 'unavailable') {
          <p class="bad">Not available right now. Please try again later.</p>
        } @else if (state() === 'limit') {
          <p class="bad">That is enough for today. Thank you!</p>
        } @else if (state() === 'failed') {
          <p class="bad">Could not send that. Please try again.</p>
        }
      </div>
    } @else {
      <div class="box">
        <div class="chips" role="group" aria-label="Amount">
          @for (c of chips; track c) {
            <button type="button" class="chip" [class.on]="amount() === c" (click)="pick(c)">₹{{ c }}</button>
          }
          <label class="custom">
            <span aria-hidden="true">₹</span>
            <input type="number" inputmode="numeric" min="1" max="100000" placeholder="Other" aria-label="Other amount in rupees" [value]="isChip() ? '' : (amount() ?? '')" (input)="custom($event)" />
          </label>
        </div>

        @if (s.isAndroid) {
          <a class="pay" [href]="s.upiUrl(amount())" (click)="started()">Pay {{ amount() ? '₹' + amount() : '' }} with a UPI app</a>
          <p class="hint">Android shows every UPI app on your phone. Come back here afterwards and I will ask how it went.</p>
        } @else if (s.isIos) {
          <div class="apps" role="group" aria-label="Pay with">
            @for (a of s.upiApps(amount()); track a.name) {
              <a [href]="a.href" [style.--c]="a.color" (click)="started()"><i aria-hidden="true"></i>{{ a.name }}<span aria-hidden="true">›</span></a>
            }
          </div>
          <p class="hint">Pick the app you pay with. If it is not installed nothing happens: use the QR code from another phone, or copy the UPI ID.</p>
        }

        @if (!s.isMobile || showQr()) {
          <div class="qr">
            @if (qr(); as src) {
              <img [src]="src" alt="UPI QR code. Scan it with any UPI app." width="180" height="180" />
            } @else {
              <span class="muted">Making the QR code…</span>
            }
            <p class="hint">{{ s.isMobile ? 'Scan this from another phone' : 'Scan with any UPI app' }} (GPay, PhonePe, Paytm, your bank's app…).</p>
          </div>
          <button type="button" class="ghost" (click)="started()">I have paid</button>
        } @else {
          <button type="button" class="ghost" (click)="openQr()">Show a QR code instead</button>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .box {
      display: grid;
      gap: 0.75rem;
      padding: 0.9rem 1rem 1rem;
      background: var(--surface);
      border-radius: 4px;
    }
    .box.ok strong {
      color: var(--good);
    }
    .box p {
      margin: 0;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }
    .chip,
    .custom {
      min-height: 0;
      padding: 0.4rem 0.9rem;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: transparent;
      color: var(--text);
      font: inherit;
      font-weight: 700;
      box-shadow: none;
    }
    .chip.on {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
    }
    .custom {
      display: inline-flex;
      align-items: center;
      gap: 0.2rem;
      padding: 0.2rem 0.8rem;
    }
    .custom input {
      width: 4.5rem;
      min-height: 0;
      padding: 0.2rem;
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
    }
    .pay,
    button:not(.chip):not(.ghost) {
      display: block;
      padding: 0.75rem 1rem;
      border: 0;
      border-radius: 999px;
      background: var(--accent);
      color: #fff;
      font: inherit;
      font-weight: 700;
      text-align: center;
      text-decoration: none;
    }
    .ghost {
      min-height: 0;
      padding: 0.5rem 1rem;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: transparent;
      color: var(--accent);
      font: inherit;
      font-weight: 600;
      box-shadow: none;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .hint,
    .muted {
      color: var(--muted);
      font-size: 0.8rem;
    }
    .bad {
      color: var(--bad);
      font-size: 0.85rem;
    }
    .apps {
      display: grid;
      gap: 2px;
    }
    .apps a {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.6rem 0.8rem;
      border-radius: 14px;
      background: var(--surface-2);
      color: var(--text);
      font-weight: 600;
      text-decoration: none;
    }
    .apps a i {
      width: 0.9rem;
      height: 0.9rem;
      border-radius: 50%;
      background: var(--c);
    }
    .apps a span {
      margin-left: auto;
      color: var(--muted);
    }
    .qr {
      display: grid;
      justify-items: center;
      gap: 0.4rem;
      text-align: center;
    }
    .qr img {
      border-radius: 12px;
      background: #fff;
      padding: 6px;
    }
  `,
})
export class UpiPay {
  protected readonly s = inject(SupportService);
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly chips = CHIPS;
  protected readonly amount = signal<number | null>(99);
  protected readonly qr = signal('');
  protected readonly showQr = signal(false);
  protected readonly busy = signal(false);
  protected readonly state = signal<'idle' | 'sent' | 'unavailable' | 'limit' | 'failed'>('idle');

  constructor() {
    // The QR code follows the amount; computers always show it, phones only when asked.
    effect(() => {
      const amount = this.amount();
      if (this.s.isMobile && !this.showQr()) return;
      void this.s.qr(amount).then((src) => this.qr.set(src));
    });
  }

  protected isChip(): boolean {
    return CHIPS.includes(this.amount() ?? -1);
  }

  protected pick(c: number): void {
    this.amount.set(c);
  }

  protected custom(e: Event): void {
    const n = Math.round(Number((e.target as HTMLInputElement).value));
    this.amount.set(n > 0 && n <= 100000 ? n : null);
  }

  protected openQr(): void {
    this.showQr.set(true);
  }

  /** The person is heading to their UPI app (or says they have paid): coming back asks how it went. */
  protected started(): void {
    this.s.startPayment(this.amount());
  }

  protected async yes(): Promise<void> {
    const p = this.s.pending();
    if (!p || this.busy()) return;
    this.busy.set(true);
    const result = await this.s.claim(p.amountInr ?? 1, 'upi', '');
    this.busy.set(false);
    this.state.set(result);
    if (result === 'sent') this.s.clearPending();
  }

  protected notYet(): void {
    this.s.clearPending();
    this.state.set('idle');
  }

  protected done(): void {
    this.state.set('idle');
    this.s.paying.set(false);
  }

  protected signIn(): void {
    this.s.open.set(false);
    void this.router.navigateByUrl('/account');
  }
}
