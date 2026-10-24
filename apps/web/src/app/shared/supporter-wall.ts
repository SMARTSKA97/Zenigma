import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { SupportService } from '../core/support.service';

/** The people who keep the servers running: a name, a tier and (only if they agreed) the amount. Nothing else is ever shown. */
@Component({
  selector: 'app-supporter-wall',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (s.supporters().length) {
      <h3>Thank you to</h3>
      <ul>
        @for (p of s.supporters(); track p.name) {
          <li [attr.data-tier]="p.tier">
            <span class="mark" aria-hidden="true">{{ p.tier === 'champion' ? '👑' : p.tier === 'patron' ? '💎' : '♥' }}</span>
            <span class="who">{{ p.name }}</span>
            @if (p.totalInr !== null) {
              <span class="amt">{{ p.display || '₹' + p.totalInr }}</span>
            }
          </li>
        }
      </ul>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    h3 {
      margin: 1.2rem 0.5rem 0.5rem;
      font-size: 0.9rem;
      color: var(--muted);
    }
    ul {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    li {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.3rem 0.8rem 0.3rem 0.6rem;
      border-radius: 999px;
      background: var(--surface);
      border: 1px solid var(--border);
      font-size: 0.9rem;
      font-weight: 600;
    }
    li[data-tier='patron'] {
      border-color: color-mix(in srgb, #db2777 50%, var(--border));
    }
    li[data-tier='champion'] {
      border-color: #f0b429;
      background: color-mix(in srgb, #f0b429 14%, var(--surface));
    }
    .mark {
      color: #db2777;
    }
    .amt {
      color: var(--muted);
      font-weight: 500;
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class SupporterWall implements OnInit {
  protected readonly s = inject(SupportService);

  ngOnInit(): void {
    void this.s.load();
  }
}
