import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SupportService } from '../core/support.service';
import { Sheet } from './sheet';
import { SupportMethods } from './support-methods';
import { SupportClaim } from './support-claim';
import { SupporterWall } from './supporter-wall';

/** One tap from anywhere: why tips matter (the servers cost money) and the ways to send one. */
@Component({
  selector: 'app-support-sheet',
  imports: [Sheet, SupportMethods, SupporterWall, SupportClaim],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (s.open() && s.canDonate()) {
      <app-sheet label="Support Zenigma" (closed)="s.open.set(false)">
        <div class="head">
          <span class="heart" aria-hidden="true">♥</span>
          <h2>Keep Zenigma running</h2>
          <p class="muted">
            Zenigma is free, has no ads and plays offline. The server, the database, the domain and the email service are paid for by one person. A tip, any size,
            keeps the daily puzzles and leaderboards online. It unlocks nothing.
          </p>
        </div>
        @if (s.tier(); as tier) {
          <p class="thanks">You are a {{ tier }}. Thank you! Your {{ tier === 'supporter' ? 'badge and' : 'badges and' }} thank-you looks are on every device you sign in on. Give again any time.</p>
        }
        <app-support-methods />
        <app-support-claim (closeSheet)="s.open.set(false)" />
        <app-supporter-wall />
        <p class="foot muted">Thank you. Made by {{ s.config.developer.name || 'one person' }}.</p>
      </app-sheet>
    }
  `,
  styles: `
    .head {
      display: grid;
      justify-items: center;
      text-align: center;
      gap: 0.4rem;
      margin-bottom: 1rem;
    }
    .head h2,
    .head p {
      margin: 0;
    }
    .heart {
      display: grid;
      place-items: center;
      width: 3.4rem;
      height: 3.4rem;
      border-radius: 42% 58% 52% 48% / 52% 44% 56% 48%;
      background: #db61a2;
      color: #fff;
      font-size: 1.6rem;
      animation: beat 1.8s ease-in-out infinite;
    }
    @keyframes beat {
      0%, 100% { transform: scale(1); }
      12% { transform: scale(1.14); }
      24% { transform: scale(1); }
    }
    :root[data-motion='reduced'] .heart {
      animation: none;
    }
    .thanks {
      margin: 0 0 0.8rem;
      padding: 0.7rem 1rem;
      border-radius: 18px;
      background: color-mix(in srgb, #db2777 12%, var(--surface));
      font-size: 0.9rem;
      text-align: center;
    }
    .foot {
      margin: 0.9rem 0 0;
      text-align: center;
      font-size: 0.85rem;
    }
  `,
})
export class SupportSheet {
  protected readonly s = inject(SupportService);
}
