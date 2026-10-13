import { PrefsService } from '../../core/prefs.service';
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
  templateUrl: './home-extras.html',
  styleUrl: './home-extras.scss',
})
export class HomeExtras implements OnInit {
  private readonly practice = inject(PracticeStore);
  private readonly sync = inject(SyncService);
  protected readonly auth = inject(AuthService);
  protected readonly prefs = inject(PrefsService);
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
