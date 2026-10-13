import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Stats } from '../core/stats.service';
import { DAILY_GAMES } from '../games/catalog';
import { Glyph } from './glyph';
import { Sheet } from './sheet';

/** Streak freezes game by game: how many each has, and how far it is from the next. */
@Component({
  selector: 'app-freeze-list',
  imports: [Glyph],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="rule">
      Play a game on <b>{{ stats().rewards.daysPerFreeze }} different days</b> to earn one freeze for that game. Each game holds up to {{ stats().rewards.maxFreezes }}. A freeze covers
      one missed day for that game automatically, so its streak carries on.
    </p>
    <ul>
      @for (g of rows(); track g.id) {
        <li [style.--h]="g.hue">
          <span class="art"><app-glyph [game]="$any(g.id)" /></span>
          <span class="mid">
            <b>{{ g.name }}</b>
            <span class="muted">{{ g.next }} more {{ g.next === 1 ? 'day' : 'days' }} played for the next freeze</span>
            <span class="pips" aria-hidden="true">
              @for (d of days(); track d) {
                <i [class.on]="d < g.progress"></i>
              }
            </span>
          </span>
          <span class="ice" [attr.aria-label]="g.freezes + ' of ' + stats().rewards.maxFreezes + ' freezes'">
            @for (n of slots(); track n) {
              <svg viewBox="0 0 24 24" [class.on]="n < g.freezes" aria-hidden="true"><path d="M12 2v20M4.5 6.5l15 11M19.5 6.5l-15 11M9 3.5l3 2.5 3-2.5M9 20.5l3-2.5 3 2.5" /></svg>
            }
          </span>
        </li>
      }
    </ul>
  `,
  styles: `
    .rule {
      margin: 0 0 0.8rem;
      font-size: 0.88rem;
      line-height: 1.45;
    }
    ul {
      display: grid;
      gap: 0.5rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    li {
      display: flex;
      align-items: center;
      gap: 0.7rem;
      padding: 0.6rem 0.7rem;
      border-radius: 16px;
      background: var(--surface-2);
    }
    .art {
      display: grid;
      place-items: center;
      flex: none;
      width: 2.6rem;
      height: 2.6rem;
      border-radius: 12px;
      background: oklch(0.92 0.06 calc(var(--h) * 1deg));
    }
    .art :is(svg) {
      width: 70%;
      height: 70%;
    }
    .mid {
      display: grid;
      flex: 1;
      min-width: 0;
      gap: 0.15rem;
      text-align: left;
    }
    .mid .muted {
      font-size: 0.74rem;
    }
    .pips {
      display: flex;
      gap: 3px;
    }
    .pips i {
      width: 100%;
      max-width: 1rem;
      height: 5px;
      border-radius: 3px;
      background: color-mix(in srgb, var(--text) 14%, transparent);
    }
    .pips i.on {
      background: #2b8fd6;
    }
    .ice {
      display: flex;
      gap: 0.25rem;
      flex: none;
    }
    .ice svg {
      width: 1.9rem;
      height: 1.9rem;
      padding: 0.3rem;
      border-radius: 10px;
      fill: none;
      stroke: var(--muted);
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
      background: var(--surface);
    }
    .ice svg.on {
      stroke: #2b8fd6;
      background: color-mix(in srgb, #2b8fd6 18%, var(--surface));
    }
  `,
})
export class FreezeList {
  readonly stats = input.required<Stats>();

  protected readonly slots = computed(() => Array.from({ length: this.stats().rewards.maxFreezes }, (_, i) => i));
  protected readonly days = computed(() => Array.from({ length: this.stats().rewards.daysPerFreeze }, (_, i) => i));
  protected readonly rows = computed(() => {
    const per = this.stats().rewards.daysPerFreeze;
    return DAILY_GAMES.map((game) => {
      const s = this.stats().games.find((g) => g.game === game.id);
      return {
        id: game.id,
        name: game.name,
        hue: game.hue,
        freezes: s?.freezes ?? 0,
        next: s?.nextFreezeIn ?? per,
        progress: per - (s?.nextFreezeIn ?? per),
      };
    });
  });
}

@Component({
  selector: 'app-freeze-sheet',
  imports: [Sheet, FreezeList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-sheet label="Streak freezes" (closed)="closed.emit()">
      <h2>❄ Streak freezes</h2>
      <app-freeze-list [stats]="stats()" />
      <button type="button" class="secondary" (click)="closed.emit()">Close</button>
    </app-sheet>
  `,
})
export class FreezeSheet {
  readonly stats = input.required<Stats>();
  readonly closed = output<void>();
}
