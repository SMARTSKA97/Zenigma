import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UpNextService } from '../core/up-next.service';
import { Glyph } from './glyph';

/** "Still to play today": the dailies not played yet, with one tap to the next one. */
@Component({
  selector: 'app-up-next',
  imports: [RouterLink, Glyph],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (list().length) {
      <section class="un" aria-label="Still to play today">
        <h3>Still to play today <small>{{ list().length }}</small></h3>
        <a class="play" [routerLink]="list()[0].link" (click)="go.emit()">
          <span class="art"><app-glyph [game]="$any(list()[0].id)" /></span>
          <span class="t"><b>Play next: {{ list()[0].name }}</b><small>{{ list()[0].group }}</small></span>
          <span class="chev" aria-hidden="true">›</span>
        </a>
        @if (list().length > 1) {
          <ul>
            @for (g of list().slice(1, 7); track g.id) {
              <li>
                <a [routerLink]="g.link" (click)="go.emit()"><span class="art"><app-glyph [game]="$any(g.id)" /></span>{{ g.name }}</a>
              </li>
            }
            @if (list().length > 7) {
              <li><a routerLink="/challenges" (click)="go.emit()">+{{ list().length - 7 }} more</a></li>
            }
          </ul>
        }
      </section>
    }
  `,
  styles: `
    :host { display: block; width: 100%; }
    .un { display: grid; gap: 0.5rem; text-align: left; }
    h3 { margin: 0; font-size: 0.95rem; display: flex; align-items: center; gap: 0.4rem; }
    h3 small { padding: 0.05rem 0.5rem; border-radius: 999px; background: var(--accent-soft); color: var(--accent); font-size: 0.75rem; }
    .play { display: flex; align-items: center; gap: 0.7rem; padding: 0.65rem 0.8rem; border-radius: 18px; background: var(--ink); color: var(--ink-contrast); text-decoration: none; }
    .play .art { display: grid; place-items: center; width: 2.2rem; height: 2.2rem; border-radius: 12px; background: rgb(255 255 255 / 0.16); }
    .t { flex: 1; display: grid; min-width: 0; }
    .t small { opacity: 0.75; }
    ul { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0; padding: 0; list-style: none; }
    li a { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.3rem 0.7rem 0.3rem 0.35rem; border-radius: 999px; border: 1px solid var(--border); background: var(--surface); color: var(--text); font-size: 0.85rem; font-weight: 600; text-decoration: none; }
    li .art { display: grid; place-items: center; width: 1.5rem; height: 1.5rem; }
  `,
})
export class UpNext implements OnInit {
  private readonly upNext = inject(UpNextService);
  /** The game that is open now: it never lists itself, and only the games after it are offered. */
  readonly exclude = input<string | null>(null);
  readonly go = output<void>();
  /**
   * What is still to play. Inside a game it lists only the games that come after it: if it listed every other unplayed game, two unplayed
   * games would send you back and forth between them. Games before it are still on the Challenges page.
   */
  protected readonly list = computed(() => {
    const all = this.upNext.items();
    const at = all.findIndex((g) => g.id === this.exclude());
    return at < 0 ? all : all.slice(at + 1);
  });

  ngOnInit(): void {
    void this.upNext.refresh();
  }
}
