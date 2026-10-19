import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WalletService } from '../core/wallet.service';

/** Three small goals a day. Each pays coins, and finishing all three opens the daily chest. */
@Component({
  selector: 'app-quests-card',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card" aria-label="Today's quests">
      <header>
        <h2>Today's quests</h2>
        <a routerLink="/store" class="link">{{ wallet.questsDone() }}/3 · 🪙 Store ›</a>
      </header>
      <ul>
        @for (q of wallet.quests(); track q.id) {
          <li [class.done]="q.done">
            <span class="tick" aria-hidden="true">{{ q.done ? '✓' : '' }}</span>
            <span class="label">{{ q.label }}</span>
            <span class="count">{{ q.count }}/{{ q.goal }}</span>
          </li>
        }
      </ul>
      <p class="chest">{{ wallet.questsDone() === 3 ? '🎁 Chest opened today. Nice.' : '🎁 Finish all three for a bonus chest.' }}</p>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }
    .card {
      display: grid;
      gap: 0.7rem;
      padding: 1rem 1.1rem;
    }
    header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 1rem;
    }
    h2 {
      margin: 0;
      font-size: 1.05rem;
    }
    .link {
      color: var(--accent);
      font-size: 0.85rem;
      font-weight: 700;
      text-decoration: none;
    }
    ul {
      display: grid;
      gap: 0.45rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    li {
      display: grid;
      grid-template-columns: 1.5rem 1fr auto;
      align-items: center;
      gap: 0.6rem;
    }
    .tick {
      display: grid;
      place-items: center;
      width: 1.5rem;
      height: 1.5rem;
      border-radius: 50%;
      border: 2px solid var(--border);
      font-size: 0.8rem;
      font-weight: 800;
    }
    li.done .tick {
      background: var(--good);
      border-color: var(--good);
      color: #fff;
    }
    li.done .label {
      color: var(--muted);
      text-decoration: line-through;
    }
    .count {
      color: var(--muted);
      font-size: 0.85rem;
      font-variant-numeric: tabular-nums;
    }
    .chest {
      margin: 0;
      color: var(--muted);
      font-size: 0.85rem;
    }
  `,
})
export class QuestsCard {
  protected readonly wallet = inject(WalletService);
}
