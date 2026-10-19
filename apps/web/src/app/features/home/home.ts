import { QuestsCard } from '../../shared/quests-card';
import { PrefsService } from '../../core/prefs.service';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApkPromoService } from '../../core/apk-promo.service';
import { AuthService } from '../../core/auth.service';
import { CommunityService } from '../../core/community.service';
import { ConnectionService } from '../../core/connection.service';
import { Stats, StatsService } from '../../core/stats.service';
import { UpdaterService } from '../../core/updater.service';
import { GAMES, gameInfo, practiceEntry } from '../../games/catalog';
import { Glyph } from '../../shared/glyph';
import { DayStreakCard } from '../../shared/day-streak-card';
import { FreezeSheet } from '../../shared/freeze-sheet';
import { HomeExtras } from './home-extras';
import { HintsService } from '../../core/hints.service';

@Component({
  selector: 'app-home',
  imports: [RouterLink, Glyph, FreezeSheet, HomeExtras, DayStreakCard, QuestsCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly community = inject(CommunityService);
  protected readonly promo = inject(ApkPromoService);
  protected readonly updater = inject(UpdaterService);
  protected readonly hints = inject(HintsService);
  protected readonly prefs = inject(PrefsService);
  private readonly statsApi = inject(StatsService);
  private readonly connection = inject(ConnectionService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly liveGames = GAMES.filter((g) => g.live && g.category !== 'mind');
  protected readonly stats = signal<Stats | null>(null);
  protected readonly freezesOpen = signal(false);

  protected openFreezes(event: Event): void {
    // The streak card is a link to Stats; the freeze chip opens the per-game list instead.
    event.preventDefault();
    event.stopPropagation();
    this.freezesOpen.set(true);
  }

  ngOnInit(): void {
    void this.promo.load();
    // Keep the counts fresh while this screen is open and visible, but only while the server is awake anyway.
    const timer = setInterval(() => {
      if (!document.hidden) void this.community.load();
    }, 30_000);
    this.destroyRef.onDestroy(() => clearInterval(timer));
  }

  constructor() {
    // Home draws at once from what this device saw last and never wakes the server itself: it refreshes only when the
    // server is awake for some other reason (and again the moment it wakes).
    effect(() => {
      const signedIn = this.auth.signedIn();
      const awake = this.connection.serverReady();
      if (!signedIn) {
        this.stats.set(null);
        return;
      }
      this.stats.update((current) => current ?? this.statsApi.peek());
      if (!awake) return;
      void this.community.load();
      void this.statsApi
        .load()
        .then((s) => {
          this.stats.set(s);
          this.hints.claimStreaks(
            s.games.map((g) => ({ game: g.game, name: gameInfo(g.game)?.name ?? g.game, current: g.current })),
            s.date,
          );
        })
        .catch(() => undefined);
    });
  }

  protected entry(id: string): string[] {
    return practiceEntry(id);
  }

  protected fmtN(n: number | undefined | null): string {
    return n === undefined || n === null ? '–' : n.toLocaleString();
  }

  /** The longest running daily streak across games. */
  protected readonly bestStreak = computed(() => Math.max(0, ...(this.stats()?.games.map((g) => g.current) ?? [])));

  /** This week, Monday to Sunday: a day is done when any daily was solved, frozen when a freeze covered it. */
  protected readonly week = computed(() => {
    const stats = this.stats();
    if (!stats) return [];
    const today = new Date(`${stats.date}T00:00:00Z`);
    const monday = new Date(today.getTime() - ((today.getUTCDay() + 6) % 7) * 86_400_000);
    const solved = new Set(stats.games.flatMap((g) => g.recent));
    const frozen = new Set(stats.games.flatMap((g) => g.frozen));
    return ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, i) => {
      const date = new Date(monday.getTime() + i * 86_400_000).toISOString().slice(0, 10);
      const state = solved.has(date) ? 'done' : frozen.has(date) ? 'frozen' : date > stats.date ? 'future' : 'open';
      return { date, label, state, today: date === stats.date };
    });
  });

  protected readonly weekLabel = computed(() => `${this.week().filter((d) => d.state === 'done').length} days played this week`);

  protected readonly greeting = computed(() => {
    const hour = new Date().getHours();
    const part = hour < 5 ? 'Still up' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const name = this.auth.user()?.displayName?.trim().split(' ')[0];
    return name ? `${part}, ${name}` : part;
  });

  protected readonly preview = [
    { letter: 'S', mark: 'absent' },
    { letter: 'O', mark: 'present' },
    { letter: 'L', mark: 'correct' },
    { letter: 'V', mark: 'absent' },
    { letter: 'E', mark: 'correct' },
  ];
}
