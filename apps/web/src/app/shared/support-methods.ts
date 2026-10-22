import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { SupportService } from '../core/support.service';

/** The ways to chip in, as one segmented list. Used by the Support sheet and the About page. */
@Component({
  selector: 'app-support-methods',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="group">
      @if (s.config.upiId) {
        <div class="row">
          <span class="tn" style="--c: #22c55e" aria-hidden="true">₹</span>
          <span class="lead">UPI<small>{{ s.config.upiId }}</small></span>
          <a class="act primary" [href]="s.upiLink">Pay</a>
          <button type="button" class="act" (click)="copy(s.config.upiId)">{{ copied() ? 'Copied' : 'Copy' }}</button>
        </div>
      }
      @if (s.config.sponsorsUrl) {
        <a class="row" [href]="s.config.sponsorsUrl" target="_blank" rel="noopener">
          <span class="tn" style="--c: #db61a2" aria-hidden="true">💖</span>
          <span class="lead">GitHub Sponsors<small>Monthly or one-off, through GitHub</small></span>
          <span class="act">Open</span>
        </a>
      }
      @if (s.config.coffeeUrl) {
        <a class="row" [href]="s.config.coffeeUrl" target="_blank" rel="noopener">
          <span class="tn" style="--c: #f5b82e" aria-hidden="true">☕</span>
          <span class="lead">Buy me a coffee<small>A one-off tip by card</small></span>
          <span class="act">Open</span>
        </a>
      }
      @if (s.config.kofiUrl) {
        <a class="row" [href]="s.config.kofiUrl" target="_blank" rel="noopener">
          <span class="tn" style="--c: #29abe0" aria-hidden="true">☕</span>
          <span class="lead">Ko-fi<small>Buy a coffee</small></span>
          <span class="act">Open</span>
        </a>
      }
      @if (s.config.paypalUrl) {
        <a class="row" [href]="s.config.paypalUrl" target="_blank" rel="noopener">
          <span class="tn" style="--c: #0070ba" aria-hidden="true">💳</span>
          <span class="lead">PayPal<small>Send a one-off amount</small></span>
          <span class="act">Open</span>
        </a>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .group {
      display: grid;
      gap: 2px;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.8rem 1rem;
      background: var(--surface);
      border-radius: 4px;
      color: var(--text);
      text-decoration: none;
    }
    .row:first-child {
      border-radius: 24px 24px 4px 4px;
    }
    .row:last-child {
      border-radius: 4px 4px 24px 24px;
    }
    .row:only-child {
      border-radius: 24px;
    }
    .tn {
      flex: none;
      display: grid;
      place-items: center;
      width: 2.8rem;
      height: 2.8rem;
      border-radius: 42% 58% 52% 48% / 52% 44% 56% 48%;
      background: var(--c, var(--accent));
      color: #fff;
      font-family: var(--font-display);
      font-size: 1.25rem;
      font-weight: 700;
    }
    .lead {
      flex: 1;
      min-width: 0;
      font-weight: 600;
    }
    .lead small {
      display: block;
      color: var(--muted);
      font-size: 0.8rem;
      font-weight: 400;
      overflow-wrap: anywhere;
    }
    :host .act {
      min-height: 0;
      padding: 0.35rem 0.9rem;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: transparent;
      color: var(--accent);
      font: inherit;
      font-size: 0.82rem;
      font-weight: 700;
      text-decoration: none;
      box-shadow: none;
    }
    :host .act.primary {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
    }
  `,
})
export class SupportMethods {
  protected readonly s = inject(SupportService);
  protected readonly copied = signal(false);

  protected async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1800);
    } catch {
      /* clipboard blocked: the value is on screen to copy by hand */
    }
  }
}
