import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { soonKindsOf } from '../games/catalog';
import { Sheet } from './sheet';

/** A small "More kinds soon" pill for a game's page. Opens a sheet listing what is on the way. Hidden when nothing is. */
@Component({
  selector: 'app-soon-pill',
  imports: [Sheet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (kinds().length) {
      <button type="button" class="pill" (click)="open.set(true)">✨ {{ kinds().length }} more {{ kinds().length === 1 ? 'kind' : 'kinds' }} coming soon</button>
      @if (open()) {
        <app-sheet label="Coming soon" (closed)="open.set(false)">
          <h2>Coming soon</h2>
          <ul>
            @for (k of kinds(); track k.name) {
              <li><b>{{ k.name }}</b><span class="muted">{{ k.blurb }}</span></li>
            }
          </ul>
        </app-sheet>
      }
    }
  `,
  styles: `
    :host {
      display: inline-block;
    }
    :host .pill {
      min-height: 0;
      padding: 0.25rem 0.7rem;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: var(--surface-2);
      color: var(--muted);
      font-size: 0.75rem;
      font-weight: 600;
    }
    h2 {
      margin: 0 0 0.6rem;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.6rem;
    }
    li {
      display: grid;
      padding: 0.7rem 0.9rem;
      border-radius: 14px;
      background: var(--surface-2);
    }
    li span {
      font-size: 0.85rem;
    }
  `,
})
export class SoonPill {
  readonly game = input.required<string>();
  protected readonly open = signal(false);
  protected readonly kinds = computed(() => soonKindsOf(this.game()));
}
