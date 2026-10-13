import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { Stats, StatsService } from '../../core/stats.service';
import { DAILY_GAMES, PRACTICE_TRACKS, SPEED_GAMES } from '../../games/catalog';
import { PracticeStore } from '../../games/puzzle/practice.store';

interface Badge {
  id: string;
  icon: string;
  name: string;
  text: string;
  have: number;
  need: number;
}

/** Badges earned just by playing: streaks, levels and a few small firsts. Worked out on this device from your progress. */
@Component({
  selector: 'app-badges',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="back" routerLink="/stats">‹ Stats</a>
    <h1>Badges</h1>
    <p class="muted lede">{{ earned() }} of {{ badges().length }} earned. Streak badges need you to be signed in.</p>
    <div class="grid">
      @for (b of badges(); track b.id) {
        <article class="badge" [class.on]="b.have >= b.need">
          <span class="icon" aria-hidden="true">{{ b.icon }}</span>
          <b>{{ b.name }}</b>
          <span class="text">{{ b.text }}</span>
          <span class="bar" role="progressbar" [attr.aria-valuenow]="min(b)" aria-valuemin="0" [attr.aria-valuemax]="b.need">
            <i [style.width.%]="(min(b) / b.need) * 100"></i>
          </span>
          <span class="num">{{ b.have >= b.need ? 'Earned' : min(b) + ' / ' + b.need }}</span>
        </article>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      max-width: 40rem;
      margin: 0 auto;
      padding: 0 1rem 7rem;
    }
    .back {
      display: inline-block;
      margin: 0.6rem 0;
      color: var(--muted);
      text-decoration: none;
    }
    h1 {
      margin: 0;
    }
    .lede {
      margin: 0.3rem 0 1rem;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.7rem;
    }
    .badge {
      display: grid;
      justify-items: center;
      gap: 0.25rem;
      padding: 0.9rem 0.7rem;
      border-radius: 20px;
      background: var(--surface);
      border: 1px solid var(--border);
      text-align: center;
      opacity: 0.72;
    }
    .badge.on {
      opacity: 1;
      background: linear-gradient(160deg, color-mix(in srgb, #f5b82e 22%, var(--surface)), var(--surface));
      border-color: color-mix(in srgb, #f5b82e 55%, var(--border));
    }
    .icon {
      font-size: 2rem;
      filter: grayscale(1);
    }
    .badge.on .icon {
      filter: none;
    }
    .text {
      color: var(--muted);
      font-size: 0.78rem;
      line-height: 1.3;
    }
    .bar {
      width: 100%;
      height: 6px;
      border-radius: 99px;
      background: var(--surface-2);
      overflow: hidden;
    }
    .bar i {
      display: block;
      height: 100%;
      background: #e0a21a;
      border-radius: 99px;
    }
    .num {
      font-size: 0.78rem;
      font-weight: 650;
    }
  `,
})
export class Badges implements OnInit {
  private readonly practice = inject(PracticeStore);
  private readonly auth = inject(AuthService);
  private readonly statsApi = inject(StatsService);
  private readonly stats = signal<Stats | null>(null);
  private readonly loaded = signal(0);

  protected readonly badges = computed<Badge[]>(() => {
    this.loaded();
    const stats = this.stats();
    const bestStreak = Math.max(0, ...(stats?.games.map((g) => Math.max(g.best, g.current)) ?? [0]));
    const dailiesPlayed = DAILY_GAMES.filter((g) => (stats?.games.find((s) => s.game === g.id)?.solved ?? 0) > 0).length;
    const dailySolved = stats?.games.reduce((n, g) => n + g.solved, 0) ?? 0;
    let speedWins = 0;
    for (const g of SPEED_GAMES) {
      try {
        const best = JSON.parse(localStorage.getItem(`zenigma.speed.${g}`) ?? 'null') as { solved: number } | null;
        if (best && best.solved >= 5) speedWins++;
      } catch {
        /* no storage: no speed badge */
      }
    }
    let levels = 0;
    let clean = 0;
    let bosses = 0;
    const gamesWithLevels = new Set<string>();
    for (const t of PRACTICE_TRACKS) {
      const solved = [...this.practice.solvedLevels(t.track)()];
      levels += solved.length;
      clean += solved.filter((l) => !this.practice.isHinted(t.track, l)).length;
      bosses += solved.filter((l) => l % 10 === 0).length;
      if (solved.length) gamesWithLevels.add(t.game);
    }
    return [
      { id: 'first', icon: '🌱', name: 'First steps', text: 'Solve your first puzzle', have: levels + dailySolved, need: 1 },
      { id: 'lv10', icon: '🔟', name: 'Ten levels', text: 'Clear 10 practice levels', have: levels, need: 10 },
      { id: 'lv100', icon: '💯', name: 'Centurion', text: 'Clear 100 practice levels', have: levels, need: 100 },
      { id: 'lv500', icon: '🏔️', name: 'Mountaineer', text: 'Clear 500 practice levels', have: levels, need: 500 },
      { id: 'lv1000', icon: '🚀', name: 'Marathoner', text: 'Clear 1,000 practice levels', have: levels, need: 1000 },
      { id: 'speed', icon: '⚡', name: 'Speed demon', text: 'Solve all five levels of a speed round', have: speedWins, need: 1 },
      { id: 'boss', icon: '👑', name: 'Zone boss', text: 'Clear a 10th level', have: bosses, need: 1 },
      { id: 'clean', icon: '🧠', name: 'No help needed', text: 'Clear 25 levels without a hint', have: clean, need: 25 },
      { id: 'all', icon: '🎲', name: 'Collector', text: 'Clear a level in every puzzle game', have: gamesWithLevels.size, need: 5 },
      { id: 'streak7', icon: '🔥', name: 'One week', text: 'A 7-day streak in any game', have: bestStreak, need: 7 },
      { id: 'streak30', icon: '🌋', name: 'Habit', text: 'A 30-day streak in any game', have: bestStreak, need: 30 },
      { id: 'streak100', icon: '☄️', name: 'Unstoppable', text: 'A 100-day streak in any game', have: bestStreak, need: 100 },
      { id: 'allDaily', icon: '📅', name: 'Daily sampler', text: 'Solve a daily in every game', have: dailiesPlayed, need: DAILY_GAMES.length },
      { id: 'daily50', icon: '🏅', name: 'Regular', text: 'Solve 50 dailies in total', have: dailySolved, need: 50 },
    ];
  });
  protected readonly earned = computed(() => this.badges().filter((b) => b.have >= b.need).length);

  ngOnInit(): void {
    for (const t of PRACTICE_TRACKS) void this.practice.load(t.track).then(() => this.loaded.update((n) => n + 1));
    if (this.auth.signedIn()) void this.statsApi.load().then((s) => this.stats.set(s)).catch(() => undefined);
  }

  protected min(b: Badge): number {
    return Math.min(b.have, b.need);
  }
}
