import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { SupportService } from '../core/support.service';

const TIERS = [
  { amount: 49, emoji: '☕', label: 'A chai' },
  { amount: 99, emoji: '🍪', label: 'A snack' },
  { amount: 199, emoji: '🍛', label: 'A meal' },
  { amount: 499, emoji: '🎉', label: 'Big thanks' },
];

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
        <div class="big" aria-hidden="true">💚</div>
        <strong>Thank you!</strong>
        <p>I will check the payment, and your badge and look switch on soon, on every device you sign in on.</p>
        <button type="button" class="primary" (click)="done()">Close</button>
      </div>
    } @else if (s.pending()) {
      <div class="box">
        <strong class="q">Did your {{ s.pending()?.amountInr ? '₹' + s.pending()?.amountInr : '' }} payment go through?</strong>
        @if (!auth.signedIn()) {
          <p>Sign in so your thank-you goes to your account, then come back and tap yes.</p>
          <div class="row">
            <button type="button" class="primary" (click)="signIn()">Sign in</button>
            <button type="button" class="ghost" (click)="notYet()">Not yet</button>
          </div>
        } @else {
          <p>Your UPI app has the receipt. Tell me and I will check it on my side.</p>
          <div class="row">
            <button type="button" class="primary" [disabled]="busy()" (click)="yes()">{{ busy() ? 'Sending…' : 'Yes, it did' }}</button>
            <button type="button" class="ghost" (click)="notYet()">No, not yet</button>
          </div>
        }
        @if (state() === 'unavailable') {
          <p class="bad">Tips are not switched on right now. Please try again later.</p>
        } @else if (state() === 'limit') {
          <p class="bad">That is enough for today. Thank you!</p>
        } @else if (state() === 'failed') {
          <p class="bad">I could not reach the server (it may be waking up). Your payment is remembered here: tap “Yes, it did” again in a minute.</p>
        }
      </div>
    } @else {
      <div class="box">
        <header>
          <span class="rupee" aria-hidden="true">₹</span>
          <div>
            <strong>Pay by UPI</strong>
            <small>{{ s.config.upiId }}</small>
          </div>
          <button type="button" class="ghost sm" (click)="copy()">{{ copied() ? 'Copied' : 'Copy ID' }}</button>
        </header>

        <div class="tiers" role="group" aria-label="Amount">
          @for (t of tiers; track t.amount) {
            <button type="button" class="tier" [class.on]="amount() === t.amount" [attr.aria-pressed]="amount() === t.amount" (click)="pick(t.amount)">
              <span class="em" aria-hidden="true">{{ t.emoji }}</span>
              <b>₹{{ t.amount }}</b>
              <small>{{ t.label }}</small>
            </button>
          }
        </div>
        <label class="custom">
          <span>Or any amount</span>
          <span class="field">₹<input type="number" inputmode="numeric" min="1" max="100000" placeholder="Your own" aria-label="Your own amount in rupees" [value]="isTier() ? '' : (amount() ?? '')" (input)="custom($event)" /></span>
        </label>

        @if (s.isMobile) {
          <div class="seg" role="tablist" aria-label="How to pay">
            <button type="button" role="tab" [attr.aria-selected]="mode() === 'apps'" [class.on]="mode() === 'apps'" (click)="mode.set('apps')">Open an app</button>
            <button type="button" role="tab" [attr.aria-selected]="mode() === 'qr'" [class.on]="mode() === 'qr'" (click)="mode.set('qr')">Show QR code</button>
          </div>
        }

        @if (mode() === 'apps' && s.isMobile) {
          @if (s.isAndroid) {
            <a class="primary pay" [href]="s.upiUrl(amount())" (click)="started()">Pay {{ amount() ? '₹' + amount() : '' }} with a UPI app</a>
            <p class="hint">Android lists every UPI app on your phone. Come back here afterwards and I will ask how it went.</p>
          } @else {
            <div class="apps" role="group" aria-label="Pay with">
              @for (a of s.upiApps(amount()); track a.name) {
                <a [href]="a.href" [style.--c]="a.color" (click)="started()"><i aria-hidden="true"></i>{{ a.name }}<span aria-hidden="true">›</span></a>
              }
            </div>
            <p class="hint">iPhone does not let websites list your installed apps. Pick yours, or choose “Any other UPI app”, or switch to the QR code and scan it from a UPI app on another phone.</p>
          }
        } @else {
          <div class="qr">
            @if (qr(); as src) {
              <img [src]="src" alt="UPI QR code. Scan it with any UPI app." width="200" height="200" />
            } @else if (qrFailed()) {
              <span class="hint">Could not make the QR code here. Copy the UPI ID and paste it into your UPI app.</span>
            } @else {
              <span class="hint">Making the QR code…</span>
            }
            <p class="hint">{{ s.isMobile ? 'Scan this from another phone' : 'Scan with any UPI app' }}: GPay, PhonePe, Paytm, your bank’s app…</p>
          </div>
          <button type="button" class="primary" (click)="started()">I have paid</button>
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
      gap: 0.85rem;
      padding-bottom: 0.5rem;
    }
    .box p {
      margin: 0;
    }
    .box.ok {
      justify-items: center;
      text-align: center;
    }
    .big {
      font-size: 3rem;
      animation: pop 0.5s var(--ease, ease-out);
    }
    @keyframes pop {
      from {
        transform: scale(0.3);
        opacity: 0;
      }
    }
    .q {
      font-size: 1.1rem;
    }
    header {
      display: flex;
      align-items: center;
      gap: 0.7rem;
    }
    header div {
      flex: 1;
      min-width: 0;
    }
    header small {
      display: block;
      color: var(--muted);
      overflow-wrap: anywhere;
    }
    .rupee {
      flex: none;
      display: grid;
      place-items: center;
      width: 2.6rem;
      height: 2.6rem;
      border-radius: 42% 58% 52% 48% / 52% 44% 56% 48%;
      background: #22c55e;
      color: #fff;
      font-family: var(--font-display);
      font-size: 1.2rem;
      font-weight: 700;
    }
    .tiers {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.5rem;
    }
    .tier {
      display: grid;
      justify-items: center;
      gap: 0.05rem;
      min-height: 0;
      padding: 0.6rem 0.3rem;
      border: 1.5px solid var(--border);
      border-radius: 18px;
      background: transparent;
      color: var(--text);
      font: inherit;
      box-shadow: none;
      transition:
        transform 0.15s,
        background 0.15s,
        border-color 0.15s;
    }
    @media (min-width: 30rem) {
      .tiers {
        grid-template-columns: repeat(4, 1fr);
      }
    }
    .tier:active {
      transform: scale(0.95);
    }
    .tier .em {
      font-size: 1.35rem;
    }
    .tier b {
      font-size: 1.05rem;
    }
    .tier small {
      color: var(--muted);
      font-size: 0.72rem;
    }
    .tier.on {
      border-color: var(--accent);
      background: color-mix(in srgb, var(--accent) 16%, transparent);
    }
    .custom {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      color: var(--muted);
      font-size: 0.85rem;
    }
    .field {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.35rem 0.8rem;
      border: 1.5px solid var(--border);
      border-radius: 999px;
      color: var(--text);
      font-weight: 700;
    }
    .field input {
      width: 6rem;
      min-height: 0;
      padding: 0.1rem;
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
    }
    .seg {
      display: grid;
      grid-template-columns: 1fr 1fr;
      padding: 3px;
      border-radius: 999px;
      background: var(--surface-2);
    }
    .seg button {
      min-height: 0;
      padding: 0.5rem;
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: var(--muted);
      font: inherit;
      font-weight: 700;
      box-shadow: none;
    }
    .seg button.on {
      background: var(--accent);
      color: #fff;
    }
    .primary {
      display: block;
      padding: 0.8rem 1rem;
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
      padding: 0.55rem 1rem;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: transparent;
      color: var(--accent);
      font: inherit;
      font-weight: 600;
      box-shadow: none;
    }
    .ghost.sm {
      padding: 0.3rem 0.8rem;
      font-size: 0.82rem;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .hint {
      color: var(--muted);
      font-size: 0.8rem;
    }
    .bad {
      color: var(--bad);
      font-size: 0.85rem;
    }
    .apps {
      display: grid;
      gap: 0.4rem;
    }
    .apps a {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.7rem 0.9rem;
      border-radius: 16px;
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
      gap: 0.5rem;
      text-align: center;
    }
    .qr img {
      width: min(62vw, 14rem);
      height: auto;
      border-radius: 14px;
      background: #fff;
      padding: 8px;
    }
  `,
})
export class UpiPay {
  protected readonly s = inject(SupportService);
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly tiers = TIERS;
  protected readonly mode = signal<'apps' | 'qr'>(this.s.isMobile ? 'apps' : 'qr');
  protected readonly copied = signal(false);
  protected readonly amount = signal<number | null>(99);
  protected readonly qr = signal('');
  protected readonly qrFailed = signal(false);
  protected readonly busy = signal(false);
  protected readonly state = signal<'idle' | 'sent' | 'unavailable' | 'limit' | 'failed'>('idle');

  constructor() {
    // The QR code follows the amount; computers always show it, phones only when asked.
    effect(() => {
      const amount = this.amount();
      if (this.mode() !== 'qr') return;
      this.qrFailed.set(false);
      void this.s
        .qr(amount)
        .then((src) => this.qr.set(src))
        .catch(() => this.qrFailed.set(true));
    });
  }

  protected isTier(): boolean {
    return TIERS.some((t) => t.amount === this.amount());
  }

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.s.config.upiId);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1800);
    } catch {
      /* the ID is on screen to copy by hand */
    }
  }

  protected pick(c: number): void {
    this.amount.set(c);
  }

  protected custom(e: Event): void {
    const n = Math.round(Number((e.target as HTMLInputElement).value));
    this.amount.set(n > 0 && n <= 100000 ? n : null);
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
