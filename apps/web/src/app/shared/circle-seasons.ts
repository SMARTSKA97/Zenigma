import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { CirclesService, Season, Seasons } from '../core/circles.service';

const MEDALS = ['🥇', '🥈', '🥉'];
const monthName = (label: string): string => new Date(`${label}-01T12:00:00`).toLocaleString('en', { month: 'long' });

/** Circle seasons: every month the circle tables start again. Shows this month's table and last month's podium. */
@Component({
  selector: 'app-circle-seasons',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './circle-seasons.html',
  styleUrl: './circle-seasons.scss',
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
