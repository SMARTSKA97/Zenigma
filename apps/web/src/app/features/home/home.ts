import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApkPromoService } from '../../core/apk-promo.service';
import { AuthService } from '../../core/auth.service';
import { CommunityService } from '../../core/community.service';
import { Stats, StatsService } from '../../core/stats.service';
import { UpdaterService } from '../../core/updater.service';
import { gameInfo, GAMES, GameId, practiceEntry } from '../../games/catalog';
import { Glyph } from '../../shared/glyph';

@Component({
  selector: 'app-home',
  imports: [RouterLink, Glyph],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page" [class.no-promo]="!promo.applicable || promo.dismissed()">
    <section class="hero">
      <div class="copy">
        <h1>{{ greeting() }}</h1>
        <p class="lede">Today's daily challenge is waiting: one puzzle per game, the same for everyone.</p>
        <a class="button play" routerLink="/daily">Play today's challenge</a>
      </div>
      <div class="preview" aria-hidden="true">
        @for (tile of preview; track $index) {
          <span class="tile" [attr.data-mark]="tile.mark" [style.--i]="$index">{{ tile.letter }}</span>
        }
      </div>
    </section>

    @if (updater.supported && updater.update() && updater.state() === 'available' && !updater.sheetOpen()) {
      <button type="button" class="update" (click)="updater.sheetOpen.set(true)">
        <span class="pulse" aria-hidden="true"></span>
        <span class="utext"><strong>Update {{ updater.update()!.version }} is ready</strong><small>See what's new and install</small></span>
        <span aria-hidden="true">›</span>
      </button>
    }

    @if (promo.applicable && !promo.dismissed()) {
      <aside class="promo" aria-label="Get the Android app">
        <button type="button" class="close" (click)="promo.dismiss()" aria-label="Hide for now">×</button>
        <div class="phone" aria-hidden="true">
          <span class="screen"><i></i><i></i><i></i><i></i></span>
        </div>
        <div class="ptext">
          <p class="eyebrow">New · Android</p>
          <h2>Take Zenigma with you</h2>
          <p class="psub">Plays offline, with haptics, daily reminders and updates built in.</p>
          <a class="button get" [href]="promo.info()?.url ?? promo.releasesPage" [attr.download]="promo.info() ? '' : null" rel="noopener">
            Download for Android
          </a>
          @if (promo.info(); as apk) {
            <small class="meta">Free · v{{ apk.version }}{{ apk.sizeMb ? ' · ' + apk.sizeMb + ' MB' : '' }}</small>
          }
        </div>
      </aside>
    }

    <a class="streaks card" routerLink="/stats" aria-label="Your streaks and stats">
      @if (!auth.signedIn()) {
        <div class="sign">
          <strong>Keep a streak</strong>
          <span class="muted">Sign in to track streaks, earn freezes and join leaderboards.</span>
        </div>
        <span class="go">Stats ›</span>
      } @else if (stats(); as s) {
        <div class="top">
          <div class="big">
            <span class="flame" aria-hidden="true">🔥</span>
            <span class="num">{{ bestStreak() }}</span>
            <span class="lab">day streak</span>
          </div>
          <div class="chips">
            <span>❄ {{ s.rewards.freezes }} {{ s.rewards.freezes === 1 ? 'freeze' : 'freezes' }}</span>
            <span>{{ s.rewards.weekSolved }}/{{ s.rewards.weekGoal }} this week</span>
          </div>
          <span class="go">Details ›</span>
        </div>
        <div class="per">
          @for (g of streakGames(); track g.game) {
            <span class="pg" [class.live]="g.current > 0" [style.--h]="g.hue">
              <app-glyph [game]="g.game" />
              <b>{{ g.current }}</b>
            </span>
          }
        </div>
      } @else {
        <div class="sign"><strong>Your streaks</strong><span class="muted">Loading</span></div>
        <span class="go">Stats ›</span>
      }
    </a>

    <section class="community card" aria-label="Community">
      <div class="stat"><b>{{ fmtN(community.counts()?.players) }}</b><span>players</span></div>
      <div class="stat"><b>{{ fmtN(community.counts()?.activeToday) }}</b><span>active today</span></div>
      <div class="stat"><b>{{ fmtN(community.counts()?.activeWeek) }}</b><span>this week</span></div>
    </section>

    <section class="practice">
      <div class="head">
        <h2>Practice</h2>
        <a routerLink="/practice">All games ›</a>
      </div>
      <div class="chips-row">
        @for (game of liveGames; track game.id) {
          <a class="pchip" [routerLink]="entry(game.id)" [style.--h]="game.hue">
            <span class="art"><app-glyph [game]="game.id" /></span>
            <span class="pname">{{ game.name }}</span>
          </a>
        }
      </div>
    </section>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .page {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 21rem);
      gap: 1rem;
      align-items: stretch;
    }
    .page > * {
      min-width: 0;
    }
    .hero,
    .update,
    .promo,
    .streaks,
    .community,
    .practice {
      grid-column: 1 / -1;
    }
    /* Wide screens: the Android card sits beside the hero, so neither stretches across an empty screen. */
    @media (min-width: 900px) {
      .page:not(.no-promo) .hero {
        grid-column: 1;
      }
      .page:not(.no-promo) .promo {
        grid-column: 2;
        grid-row: 1;
      }
      .update {
        grid-column: 1 / -1;
      }
      .streaks {
        grid-column: 1;
      }
      .community {
        grid-column: 2;
      }
    }

    .hero {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      gap: 2rem;
      padding: clamp(1.5rem, 4vw, 2.75rem);
      border-radius: 28px;
      background: var(--ink);
      color: var(--ink-contrast);
      overflow: hidden;
    }
    .hero h1 {
      margin-bottom: 0.6rem;
    }
    .lede {
      max-width: 30ch;
      margin-bottom: 1.5rem;
      opacity: 0.72;
    }
    .play {
      background: var(--ink-contrast);
      color: var(--ink);
      border-color: var(--ink-contrast);
    }
    .preview {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 0.4rem;
      width: min(100%, 19rem);
    }
    .tile {
      aspect-ratio: 1;
      display: grid;
      place-items: center;
      border-radius: 12px;
      font-family: var(--font-display);
      font-weight: 700;
      font-size: clamp(1.1rem, 4vw, 1.6rem);
      color: #fff;
      background: color-mix(in srgb, var(--ink-contrast) 14%, transparent);
      animation: reveal 0.6s var(--ease) backwards;
      animation-delay: calc(0.35s + var(--i) * 0.16s);
    }
    .tile[data-mark='correct'] {
      background: var(--mark-correct);
    }
    .tile[data-mark='present'] {
      background: var(--mark-present);
    }
    .tile[data-mark='absent'] {
      background: color-mix(in srgb, var(--ink-contrast) 22%, transparent);
    }
    @keyframes reveal {
      0% {
        transform: rotateX(90deg);
        background: color-mix(in srgb, var(--ink-contrast) 14%, transparent);
      }
    }

    /* Update ready (Android) */
    .update {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      width: 100%;
      padding: 0.85rem 1rem;
      text-align: left;
      color: var(--text);
      background: var(--accent-soft);
      border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--border));
      border-radius: var(--radius);
    }
    .utext {
      display: grid;
      flex: 1;
    }
    .utext small {
      color: var(--muted);
    }
    .pulse {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--accent);
      box-shadow: 0 0 0 0 var(--accent);
      animation: ping 1.8s ease-out infinite;
    }
    @keyframes ping {
      70%,
      100% {
        box-shadow: 0 0 0 10px transparent;
      }
    }

    /* Android promo (web only): compact, with a little motion to catch the eye */
    .promo {
      position: relative;
      display: grid;
      grid-template-columns: auto 1fr;
      align-items: center;
      gap: 1.1rem;
      padding: 1.25rem;
      border-radius: 28px;
      color: #fff;
      background: linear-gradient(135deg, oklch(0.52 0.19 275), oklch(0.46 0.2 305));
      overflow: hidden;
      isolation: isolate;
    }
    .promo::before {
      content: '';
      position: absolute;
      inset: -40% -20% auto auto;
      width: 14rem;
      height: 14rem;
      border-radius: 50%;
      background: radial-gradient(circle, rgb(255 255 255 / 0.28), transparent 65%);
      z-index: -1;
      animation: drift 6s ease-in-out infinite alternate;
    }
    @keyframes drift {
      to {
        transform: translate(-1.5rem, 1rem) scale(1.15);
      }
    }
    .promo .close {
      position: absolute;
      top: 0.35rem;
      right: 0.45rem;
      width: 2rem;
      height: 2rem;
      min-height: 0;
      padding: 0;
      font-size: 1.3rem;
      line-height: 1;
      color: rgb(255 255 255 / 0.75);
      background: transparent;
      border: 0;
    }
    .phone {
      width: 4.1rem;
      height: 6.6rem;
      padding: 0.3rem;
      border-radius: 1rem;
      background: #0d0d14;
      box-shadow: 0 10px 24px rgb(0 0 0 / 0.35);
      transform: rotate(-6deg);
      animation: bob 3.4s ease-in-out infinite;
    }
    @keyframes bob {
      50% {
        transform: rotate(-3deg) translateY(-4px);
      }
    }
    .screen {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.2rem;
      height: 100%;
      padding: 0.35rem;
      border-radius: 0.75rem;
      background: #f4f1ea;
      align-content: center;
    }
    .screen i {
      aspect-ratio: 1;
      border-radius: 0.28rem;
      background: #bfc4ff;
    }
    .screen i:nth-child(2) {
      background: #7fd6a4;
    }
    .screen i:nth-child(3) {
      background: #ffd479;
    }
    .eyebrow {
      margin: 0 0 0.15rem;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      opacity: 0.8;
    }
    .promo h2 {
      margin: 0 0 0.25rem;
      font-size: 1.25rem;
      color: #fff;
    }
    .psub {
      margin: 0 0 0.85rem;
      font-size: 0.85rem;
      line-height: 1.35;
      opacity: 0.85;
    }
    .get {
      display: inline-flex;
      align-items: center;
      gap: 0.6rem;
      color: #2a1a63;
      background: #fff;
      border-color: #fff;
    }
    .get {
      white-space: nowrap;
    }
    .meta {
      display: block;
      margin-top: 0.45rem;
      font-size: 0.72rem;
      opacity: 0.8;
    }

    .card {
      padding: 1rem 1.1rem;
    }
    .streaks {
      display: grid;
      gap: 0.8rem;
      color: inherit;
      text-decoration: none;
      transition: transform 0.25s var(--ease), box-shadow 0.25s var(--ease);
    }
    .streaks:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-lift);
    }
    .streaks .top {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem 1rem;
    }
    .big {
      display: flex;
      align-items: baseline;
      gap: 0.4rem;
    }
    .flame {
      align-self: center;
      font-size: 1.5rem;
    }
    .num {
      font-family: var(--font-display);
      font-size: 2.1rem;
      font-weight: 750;
      letter-spacing: -0.03em;
    }
    .lab {
      color: var(--muted);
      font-size: 0.85rem;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      flex: 1;
    }
    .chips span {
      padding: 0.25rem 0.6rem;
      font-size: 0.78rem;
      font-weight: 600;
      border-radius: 99px;
      background: var(--surface-2);
    }
    .go {
      margin-left: auto;
      color: var(--accent);
      font-size: 0.85rem;
      font-weight: 650;
    }
    .sign {
      display: grid;
      gap: 0.15rem;
    }
    .streaks:has(.sign) {
      grid-template-columns: 1fr auto;
      align-items: center;
    }
    .per {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }
    .pg {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.2rem 0.55rem 0.2rem 0.3rem;
      border-radius: 99px;
      background: var(--surface-2);
      color: var(--muted);
      font-size: 0.8rem;
    }
    .pg app-glyph {
      width: 1.35rem;
      height: 1.35rem;
      padding: 0.2rem;
      border-radius: 50%;
      background: oklch(var(--tile-l) var(--tile-c) calc(var(--h) * 1deg));
      color: oklch(var(--glyph-l) var(--glyph-c) calc(var(--h) * 1deg));
    }
    .pg.live {
      color: var(--text);
    }
    .pg:not(.live) app-glyph {
      opacity: 0.55;
    }

    .community {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      align-items: center;
      text-align: center;
      gap: 0.5rem;
    }
    .stat {
      display: grid;
      gap: 0.1rem;
    }
    .stat b {
      font-family: var(--font-display);
      font-size: clamp(1.35rem, 5vw, 1.8rem);
      font-weight: 750;
      letter-spacing: -0.03em;
    }
    .stat span {
      color: var(--muted);
      font-size: 0.75rem;
    }
    .stat + .stat {
      border-left: 1px solid var(--border);
    }

    .practice .head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin: 0.5rem 0 0.6rem;
    }
    .practice h2 {
      margin: 0;
      font-size: 1.1rem;
    }
    .practice .head a {
      color: var(--accent);
      font-size: 0.85rem;
      font-weight: 650;
      text-decoration: none;
    }
    .chips-row {
      display: flex;
      gap: 0.6rem;
      overflow-x: auto;
      padding: 0.1rem 0 0.4rem;
      scrollbar-width: none;
      scroll-snap-type: x proximity;
    }
    .pchip {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.5rem 0.9rem 0.5rem 0.5rem;
      color: inherit;
      text-decoration: none;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 99px;
      scroll-snap-align: start;
      transition: transform 0.2s var(--ease);
    }
    .pchip:active {
      transform: scale(0.97);
    }
    .pchip .art {
      width: 2.2rem;
      height: 2.2rem;
      padding: 0.4rem;
      border-radius: 50%;
      background: oklch(var(--tile-l) var(--tile-c) calc(var(--h) * 1deg));
      color: oklch(var(--glyph-l) var(--glyph-c) calc(var(--h) * 1deg));
    }
    .pname {
      font-weight: 600;
      font-size: 0.9rem;
      white-space: nowrap;
    }

    @media (max-width: 720px) {
      .page {
        gap: 0.75rem;
      }
      .hero {
        grid-template-columns: 1fr;
        gap: 1.5rem;
        border-radius: 24px;
      }
      .preview {
        order: -1;
        width: min(100%, 15rem);
      }
    }
    @media (max-width: 420px) {
      .promo {
        grid-template-columns: 1fr;
        justify-items: start;
      }
      .phone {
        display: none;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .promo::before,
      .phone,
      .pulse {
        animation: none;
      }
    }
  `,
})
export class Home implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly community = inject(CommunityService);
  protected readonly promo = inject(ApkPromoService);
  protected readonly updater = inject(UpdaterService);
  private readonly statsApi = inject(StatsService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly liveGames = GAMES.filter((g) => g.live);
  protected readonly stats = signal<Stats | null>(null);

  ngOnInit(): void {
    void this.community.load();
    void this.promo.load();
    // Keep the counts fresh while this screen is open and visible.
    const timer = setInterval(() => {
      if (!document.hidden) void this.community.load();
    }, 30_000);
    this.destroyRef.onDestroy(() => clearInterval(timer));
  }

  constructor() {
    // The session can be restored after this screen opens, so load the summary whenever someone is (or becomes) signed in.
    effect(() => {
      if (this.auth.signedIn()) void this.statsApi.load().then((s) => this.stats.set(s)).catch(() => this.stats.set(null));
      else this.stats.set(null);
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

  protected readonly streakGames = computed(() =>
    (this.stats()?.games ?? []).map((g) => ({ game: g.game as GameId, current: g.current, hue: gameInfo(g.game)?.hue ?? 250 })),
  );

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
