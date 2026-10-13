import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ConnectionService } from '../../core/connection.service';
import { MindSyncService } from '../../core/mind-sync.service';
import { ProfileService } from '../../core/profile.service';
import { GAMES, MIND_LIVE, MindGameId, Skill, SKILLS } from '../../games/catalog';
import { MindDailyService } from '../../games/mind/mind-daily';
import { MIND_META } from '../../games/mind/mind-meta';
import { MindStore } from '../../games/mind/mind-store';
import { Glyph } from '../../shared/glyph';
import { Brain } from './brain';
import { MindDailyPanel } from './mind-daily-panel';
import { Radar, RadarAxis } from './radar';

/** Mind: today's set, a picture of your skills (brain and radar) with how you compare with other players, and every game by skill. */
@Component({
  selector: 'app-mind-home',
  imports: [RouterLink, Glyph, Brain, Radar, MindDailyPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mind-home.html',
  styleUrl: './mind-home.scss',
})
export class MindHome implements OnInit {
  protected readonly store = inject(MindStore);
  protected readonly daily = inject(MindDailyService);
  protected readonly auth = inject(AuthService);
  protected readonly conn = inject(ConnectionService);
  protected readonly mindApi = inject(MindSyncService);
  private readonly profileApi = inject(ProfileService);

  protected readonly skills = SKILLS;
  protected readonly total = MIND_LIVE.length;
  protected readonly selected = signal<Skill | null>(null);
  protected readonly filter = signal<Skill | 'all'>('all');
  protected readonly group = signal(0);
  protected readonly saving = signal(false);

  protected readonly marks = computed(() => {
    const out = {} as Record<Skill, number>;
    for (const s of SKILLS) out[s.id] = this.store.skills().find((x) => x.skill === s.id)?.mark ?? 0;
    return out;
  });
  protected readonly played = computed(() => this.store.gamesPlayed());
  protected readonly overall = computed(() => Math.round(SKILLS.reduce((n, s) => n + this.marks()[s.id], 0) / SKILLS.length));

  protected readonly compare = this.mindApi.compare;
  protected readonly active = computed(() => this.compare()?.groups[this.group()] ?? null);
  protected readonly axes = computed<RadarAxis[]>(() =>
    SKILLS.map((s) => {
      const other = this.active()?.skills.find((x) => x.skill === s.id)?.average;
      return { label: s.name, you: this.marks()[s.id], other: this.active()?.ready && other != null ? other : null };
    }),
  );
  protected readonly detail = computed(() => {
    const skill = this.selected();
    if (!skill) return null;
    const info = this.store.skills().find((s) => s.skill === skill);
    const cmp = this.active()?.skills.find((x) => x.skill === skill);
    const games = MIND_LIVE.filter((g) => MIND_META[g]?.skill === skill);
    return { skill: SKILLS.find((s) => s.id === skill)!, mark: info?.mark ?? 0, played: info?.played ?? 0, total: info?.total ?? games.length, cmp, games };
  });

  protected readonly list = computed(() =>
    GAMES.filter((g) => g.category === 'mind' && g.live && (this.filter() === 'all' || g.skill === this.filter())).map((g) => ({
      game: g,
      rec: this.store.record(g.id),
      meta: MIND_META[g.id as MindGameId],
      today: this.daily.inSet(g.id),
    })),
  );
  protected readonly soon = GAMES.filter((g) => g.category === 'mind' && !g.live);

  ngOnInit(): void {
    this.daily.refresh();
    void this.profileApi.load();
    void this.mindApi.load();
  }

  protected best(row: { rec: { best: number; plays: number }; meta?: { format?: (n: number) => string; unit: string } }): string {
    if (!row.rec.plays) return 'Not played';
    return row.meta?.format ? row.meta.format(row.rec.best) : `${row.rec.best} ${row.meta?.unit ?? ''}`.trim();
  }

  protected async join(): Promise<void> {
    this.saving.set(true);
    try {
      await this.profileApi.save({ shareCohort: true });
      await this.mindApi.load();
    } finally {
      this.saving.set(false);
    }
  }

  protected beat(percentile: number | null | undefined): string {
    return percentile == null ? '' : percentile >= 50 ? `Ahead of ${percentile}% of players` : `${100 - percentile}% of players are ahead`;
  }
}
