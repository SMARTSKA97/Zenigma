import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { CirclesService, CircleToday } from '../../core/circles.service';
import { CircleSeasons } from '../../shared/circle-seasons';
import { Stats } from '../../core/stats.service';
import { SyncService } from '../../core/sync.service';
import { gameInfo, playLink, PRACTICE_TRACKS, PracticeTrack } from '../../games/catalog';
import { PracticeStore } from '../../games/puzzle/practice.store';
import { ChallengeStrip } from '../challenges/challenges';
import { ChallengesService } from '../challenges/challenges.service';

const RECAP_KEY = 'zenigma.recap.dismissed';

const dayKey = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** The Monday (local time) of the week a date is in. */
const mondayOf = (d: Date): Date => {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
};

/** Two small cards for Home: pick up an unfinished practice board, and a recap of last week (shown on Monday and Tuesday). */
@Component({
  selector: 'app-home-extras',
  imports: [RouterLink, CircleSeasons, ChallengeStrip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (atRisk(); as risk) {
      <a class="card rescue" routerLink="/daily">
        <span class="emoji" aria-hidden="true">🔥</span>
        <span class="t">
          <b>Your {{ risk.name }} streak ({{ risk.days }} days) ends at midnight</b>
          <small>Play today's {{ risk.name }} daily to keep it going</small>
        </span>
        <span class="go" aria-hidden="true">›</span>
      </a>
    }
    @if (resume(); as r) {
      <a class="card resume" [routerLink]="r.link">
        <span class="emoji" aria-hidden="true">▶</span>
        <span class="t">
          <b>Continue {{ r.name }}</b>
          <small>Level {{ r.level }} is waiting where you left it</small>
        </span>
        <span class="go" aria-hidden="true">›</span>
      </a>
    }
    @if (challenges.toCollect() > 0) {
      <app-challenge-strip />
    }
    @if (played().length) {
      <a class="card friends" routerLink="/ranks/circles" aria-label="Friends who played today">
        <p class="eyebrow">Friends today</p>
        <div class="faces">
          @for (f of played(); track f.name) {
            <span class="face"><b>{{ f.name.charAt(0).toUpperCase() }}</b><span>{{ f.name }} · {{ f.solved }} {{ f.solved === 1 ? 'daily' : 'dailies' }}</span></span>
          }
        </div>
      </a>
    }
    @if (auth.signedIn()) {
      <app-circle-seasons mode="podium" />
    }
    @if (recap(); as w) {
      <section class="card recap" aria-label="Last week">
        <button type="button" class="x" (click)="dismiss()" aria-label="Hide">×</button>
        <p class="eyebrow">Your last week</p>
        <h2>You solved {{ w.solved }} {{ w.solved === 1 ? 'puzzle' : 'puzzles' }}</h2>
        <p class="muted">
          On {{ w.days }} {{ w.days === 1 ? 'day' : 'days' }}{{ w.favourite ? ', mostly ' + w.favourite : '' }}. New week, new streak chances.
        </p>
      </section>
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: 0.75rem;
      margin-bottom: 0.75rem;
    }
    :host:empty {
      display: none;
    }
    .card {
      position: relative;
      padding: 0.9rem 1rem;
      border-radius: var(--radius);
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text);
      text-decoration: none;
    }
    .resume {
      display: flex;
      align-items: center;
      gap: 0.8rem;
    }
    .emoji {
      display: grid;
      place-items: center;
      width: 2.4rem;
      height: 2.4rem;
      border-radius: 50%;
      background: var(--accent-soft);
      color: var(--accent);
    }
    .t {
      flex: 1;
      display: grid;
    }
    .t small {
      color: var(--muted);
    }
    .friends {
      display: grid;
      gap: 0.4rem;
    }
    .faces {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }
    .face {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.2rem 0.6rem 0.2rem 0.2rem;
      border-radius: 999px;
      background: var(--surface-2);
      font-size: 0.8rem;
    }
    .face b {
      display: grid;
      place-items: center;
      width: 1.5rem;
      height: 1.5rem;
      border-radius: 50%;
      background: var(--accent-soft);
      color: var(--accent);
      font-size: 0.75rem;
    }
    .go {
      color: var(--muted);
      font-size: 1.4rem;
    }
    .rescue {
      display: flex;
      align-items: center;
      gap: 0.8rem;
      border-color: color-mix(in srgb, #f59e0b 50%, var(--border));
      background: color-mix(in srgb, #f59e0b 12%, var(--surface));
    }
    .recap h2 {
      margin: 0.1rem 0 0.2rem;
      font-size: 1.15rem;
    }
    .recap p {
      margin: 0;
    }
    .eyebrow {
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--accent);
    }
    :host .x {
      position: absolute;
      top: 0.3rem;
      right: 0.4rem;
      min-height: 0;
      width: 2rem;
      height: 2rem;
      padding: 0;
      border: 0;
      background: transparent;
      box-shadow: none;
      color: var(--muted);
      font-size: 1.3rem;
    }
  `,
})
export class HomeExtras implements OnInit {
  private readonly practice = inject(PracticeStore);
  private readonly sync = inject(SyncService);
  protected readonly auth = inject(AuthService);
  private readonly circlesApi = inject(CirclesService);
  private readonly circles = signal<CircleToday[]>([]);
  /** Friends (across all my circles, each once) who have solved at least one daily today. */
  protected readonly played = computed(() => {
    const seen = new Map<string, { name: string; solved: number }>();
    for (const c of this.circles()) for (const f of c.friends) if (f.solved > 0 && !seen.has(f.name)) seen.set(f.name, f);
    return [...seen.values()].slice(0, 8);
  });

  /** The signed-in player's stats, to spot a streak that is about to end. */
  readonly stats = input<Stats | null>(null);
  /** A streak that has not been played or frozen today, in the evening (India time follows the server's date). */
  protected readonly atRisk = computed(() => {
    const s = this.stats();
    if (!s || new Date().getHours() < 17) return null;
    const risky = s.games.filter((g) => g.current >= 2 && !g.recent.includes(s.date) && !g.frozen.includes(s.date)).sort((a, b) => b.current - a.current)[0];
    return risky ? { name: gameInfo(risky.game)?.name ?? risky.game, days: risky.current } : null;
  });
  protected readonly resume = signal<{ name: string; level: number; link: string[] } | null>(null);
  private readonly hidden = signal(this.readDismissed());

  protected readonly recap = computed(() => {
    const today = new Date();
    const weekday = (today.getDay() + 6) % 7;
    if (weekday > 1) return null; // Monday and Tuesday only
    const thisMonday = mondayOf(today);
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(lastMonday.getDate() - 7);
    const key = dayKey(lastMonday);
    if (this.hidden() === key) return null;

    const days = new Set<string>();
    const perGame = new Map<string, number>();
    let solved = 0;
    for (const e of this.sync.events()) {
      const at = new Date(e.clientCreatedAt);
      if (Number.isNaN(at.getTime()) || at < lastMonday || at >= thisMonday) continue;
      const payload = e.payload as { game?: string; status?: string } | null;
      let game: string | null = null;
      if (e.kind === 'puzzle.practice.solved') game = payload?.game ?? null;
      else if (e.kind === 'wordguess.finished' && payload?.status === 'won') game = 'word-guess';
      if (!game) continue;
      solved++;
      days.add(dayKey(at));
      perGame.set(game, (perGame.get(game) ?? 0) + 1);
    }
    if (!solved) return null;
    const top = [...perGame.entries()].sort((a, b) => b[1] - a[1])[0];
    return { solved, days: days.size, favourite: top ? (gameInfo(top[0])?.name ?? null) : null, key };
  });

  protected readonly challenges = inject(ChallengesService);

  async ngOnInit(): Promise<void> {
    void this.challenges.load();
    if (this.auth.signedIn()) void this.circlesApi.today().then((c) => this.circles.set(c)).catch(() => undefined);
    // The most recently saved unfinished board among all practice tracks.
    let best: { track: PracticeTrack; level: number; saved: number } | null = null;
    for (const track of PRACTICE_TRACKS) {
      const board = await this.practice.loadBoard(track.track).catch(() => undefined);
      if (!board) continue;
      const saved = (board as { savedAt?: number }).savedAt ?? 0;
      if (!best || saved > best.saved) best = { track, level: board.level, saved };
    }
    if (!best) return;
    const { track, level } = best;
    const info = gameInfo(track.game);
    const kind = track.variant ? ` ${track.variant.replace('-', ' ')}` : '';
    this.resume.set({ name: `${info?.name ?? track.game}${kind}`, level, link: playLink(track.game, track.variant) });
  }

  protected dismiss(): void {
    const key = this.recap()?.key;
    if (!key) return;
    this.hidden.set(key);
    try {
      localStorage.setItem(RECAP_KEY, key);
    } catch {
      /* storage unavailable: it comes back next visit */
    }
  }

  private readDismissed(): string | null {
    try {
      return localStorage.getItem(RECAP_KEY);
    } catch {
      return null;
    }
  }
}
