import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** The Puzzles / Mind switch at the top of Practice. Each side is its own page with its own layout. */
@Component({
  selector: 'app-practice-tabs',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="tabs" aria-label="Practice type">
      <a routerLink="/practice" replaceUrl [attr.aria-current]="active() === 'puzzles' ? 'page' : null"><span aria-hidden="true">🧩</span> Puzzles</a>
      <a routerLink="/mind" replaceUrl [attr.aria-current]="active() === 'mind' ? 'page' : null"><span aria-hidden="true">🧠</span> Mind</a>
    </nav>
  `,
  styles: `
    :host {
      display: block;
      margin-bottom: 1.1rem;
    }
    .tabs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.25rem;
      padding: 0.25rem;
      border-radius: 999px;
      background: var(--surface-2);
    }
    a {
      padding: 0.6rem 0.5rem;
      border-radius: 999px;
      color: var(--muted);
      font-weight: 700;
      text-align: center;
      text-decoration: none;
    }
    a[aria-current='page'] {
      background: var(--surface);
      color: var(--text);
      box-shadow: 0 1px 4px rgb(0 0 0 / 0.12);
    }
  `,
})
export class PracticeTabs {
  readonly active = input.required<'puzzles' | 'mind'>();
}
