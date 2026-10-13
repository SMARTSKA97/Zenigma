import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { CirclesService, Season, Seasons } from '../core/circles.service';

const MEDALS = ['🥇', '🥈', '🥉'];
const monthName = (label: string): string => new Date(`${label}-01T12:00:00`).toLocaleString('en', { month: 'long' });

/** Circle seasons: every month the circle tables start again. Shows this month's table and last month's podium. */
@Component({
  selector: 'app-circle-seasons',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (shown(); as blocks) {
      @for (b of blocks; track b.key) {
        <section class="card season">
          <p class="eyebrow">{{ b.title }}</p>
          @for (c of b.season.circles; track c.id) {
            @if (c.top.length) {
              <div class="circle">
                <b>{{ c.name }}</b>
                <ol>
                  @for (e of c.top; track $index) {
                    <li [class.me]="e.isMe"><span class="medal">{{ medal($index) }}</span><span class="n">{{ e.name }}</span><span class="v">{{ e.solved }}</span></li>
                  }
                </ol>
              </div>
            }
          }
          <p class="muted tiny">Ranked by dailies solved in the month. Tables start again on the 1st.</p>
        </section>
      }
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: 0.75rem;
    }
    :host:empty {
      display: none;
    }
    .season {
      padding: 0.9rem 1rem;
      border-radius: var(--radius);
      border: 1px solid var(--border);
      background: var(--surface);
    }
    .eyebrow {
      margin: 0 0 0.5rem;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--accent);
    }
    .circle + .circle {
      margin-top: 0.75rem;
    }
    ol {
      list-style: none;
      margin: 0.3rem 0 0;
      padding: 0;
      display: grid;
      gap: 0.2rem;
    }
    li {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.9rem;
    }
    li.me {
      font-weight: 700;
    }
    .n {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .v {
      font-variant-numeric: tabular-nums;
      color: var(--muted);
    }
    .tiny {
      margin: 0.6rem 0 0;
      font-size: 0.75rem;
    }
  `,
})
export class CircleSeasons implements OnInit {
  private readonly api = inject(CirclesService);
  /** "podium" shows only last month's winners (for Home, in the first days of a month); "all" shows this month and last. */
  readonly mode = input<'all' | 'podium'>('all');
  private readonly data = signal<Seasons | null>(null);

  protected readonly shown = computed(() => {
    const d = this.data();
    if (!d) return null;
    const hasTop = (s: Season) => s.circles.some((c) => c.top.length > 0);
    const out: { key: string; title: string; season: Season }[] = [];
    if (this.mode() === 'all' && hasTop(d.current)) out.push({ key: 'now', title: `${monthName(d.current.label)} season so far`, season: d.current });
    if (hasTop(d.previous) && (this.mode() === 'all' || new Date().getDate() <= 5)) out.push({ key: 'last', title: `${monthName(d.previous.label)} podium`, season: d.previous });
    return out.length ? out : null;
  });

  ngOnInit(): void {
    void this.api.seasons().then((s) => this.data.set(s)).catch(() => undefined);
  }

  protected medal(i: number): string {
    return MEDALS[i] ?? '';
  }
}
