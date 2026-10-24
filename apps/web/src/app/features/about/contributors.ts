import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SupportService } from '../../core/support.service';
import { SupportMethods } from '../../shared/support-methods';
import { SupporterWall } from '../../shared/supporter-wall';

/** Always there (even before the first supporter): who keeps the servers running, and how to join them. */
@Component({
  selector: 'app-contributors',
  imports: [RouterLink, SupportMethods, SupporterWall],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="back" routerLink="/settings">‹ Settings</a>
    <h1>Contributors</h1>
    <p class="lede">Zenigma is free, with no ads and no paywalls. These people pay for the servers, the domain and the email service.</p>

    <section class="hero" [class.thanks]="support.tier()">
      <span class="big" aria-hidden="true">{{ support.tier() ? '💖' : '♥' }}</span>
      <div>
        @if (support.tier()) {
          <strong>You are one of them. Thank you!</strong>
          <small>Your supporter look and badge are yours on every device, even offline.</small>
        } @else {
          <strong>{{ support.supporters().length ? support.supporters().length + ' people keep Zenigma running' : 'Be the first to chip in' }}</strong>
          <small>Supporters get a thank-you badge, a special colour and a ♥ next to their name on the rankings.</small>
        }
      </div>
    </section>

    @if (support.supporters().length) {
      <app-supporter-wall />
    } @else {
      <p class="empty">No names here yet. When someone supports Zenigma, their name shows up here.</p>
    }

    @if (support.canDonate()) {
      <section class="card">
        <h2>Support Zenigma</h2>
        <p class="muted">Optional, and nothing is locked behind it. Already sent a tip? Use "Tell me" below so I can switch your perks on.</p>
        <app-support-methods />
      </section>
    }
  `,
  styles: `
    :host {
      display: block;
      max-width: 36rem;
      margin: 0 auto;
    }
    .back {
      display: inline-block;
      margin-bottom: 0.5rem;
      color: var(--muted);
      font-weight: 600;
      text-decoration: none;
    }
    .lede,
    .empty {
      color: var(--muted);
      margin: 0 0 1rem;
    }
    .hero {
      display: flex;
      align-items: center;
      gap: 0.9rem;
      padding: 1rem;
      border-radius: 28px;
      border: 1px solid color-mix(in srgb, #db61a2 40%, var(--border));
      background: linear-gradient(115deg, color-mix(in srgb, #db61a2 16%, var(--surface)), var(--surface));
    }
    .hero.thanks {
      border-color: #db2777;
    }
    .big {
      flex: none;
      display: grid;
      place-items: center;
      width: 3rem;
      height: 3rem;
      border-radius: 42% 58% 52% 48% / 52% 44% 56% 48%;
      background: #db61a2;
      color: #fff;
      font-size: 1.4rem;
    }
    small {
      display: block;
      color: var(--muted);
    }
    .card {
      margin-top: 1.25rem;
    }
  `,
})
export class Contributors implements OnInit {
  protected readonly support = inject(SupportService);

  ngOnInit(): void {
    void this.support.refresh();
  }
}
