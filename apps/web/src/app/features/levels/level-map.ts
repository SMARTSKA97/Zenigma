import { BackService } from '../../core/back.service';
import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, afterNextRender, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { gameInfo, levelCountOf, TIERS, isPuzzleGame, playLink, PuzzleGameId, trackOf, variantsOf } from '../../games/catalog';
import { difficultyOf, parMs, starsFor } from '../../games/puzzle/par';
import { loadPack, packOf, PACK_SIZE } from '../../games/puzzle/level-source';
import { PracticeStore, ZONE_SIZE } from '../../games/puzzle/practice.store';
import { formatDuration } from '../../core/leaderboard.service';
import { Glyph } from '../../shared/glyph';
import { Sheet } from '../../shared/sheet';

/** The drawing of one zone is 360 wide by 920 tall (84 per level, plus room for the banner); everything is placed in those units and scales with the screen. */
const W = 360;
const GAP = 84;
/** The map draws at most this many zones (the latest ones), so very long tracks stay light. */
const MAX_ZONES = 60;
const ZONE_H = GAP * ZONE_SIZE;
/** Room above the first row for the zone's banner. */
const TOP = 80;
const H = TOP + ZONE_H;

const ZONE_NAMES = ['Meadow Start', 'Lantern Hills', 'Whisper Woods', 'Sunrise Bay', 'Honey Fields', 'Pebble Brook', 'Moss Gardens', 'Starlight Ridge', 'Copper Canyon', 'Frost Hollow', 'Velvet Dunes', 'Ember Mesa'];

interface Decor {
  kind: 'tree' | 'bush' | 'cloud' | 'rock' | 'flower';
  x: number;
  y: number;
  s: number;
}

interface NodeView {
  level: number;
  x: number;
  y: number;
  state: 'done' | 'now' | 'open' | 'locked';
  hard: boolean;
  stars: number;
}

interface ZoneView {
  index: number;
  name: string;
  hue: number;
  nodes: NodeView[];
  path: string;
  decor: Decor[];
  /** Fraction of the zone's levels solved. */
  done: number;
}

/** Where level n sits across the width (0 to 360): a lazy S-curve that carries on between zones. */
const xOf = (level: number): number => W / 2 + 112 * Math.sin(level * 0.78 + 0.6);

/** Where the road crosses the line between level `level` and the next one: the same spot for both zones, so the road is one piece. */
const crossingX = (level: number): number => (xOf(level) + xOf(level + 1)) / 2;

/**
 * A smooth curve through the points (Catmull-Rom turned into cubic Béziers). With `vertical`, the first and last
 * point are on a zone's edge and the road meets it heading straight up or down, so neighbouring zones join without a kink.
 */
function smooth(points: [number, number][], vertical: { start: boolean; end: boolean }): string {
  if (points.length < 2) return '';
  const last = points.length - 2;
  let d = `M${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  for (let i = 0; i <= last; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    let c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    let c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    const reach = Math.abs(p2[1] - p1[1]) * 0.45;
    if (i === 0 && vertical.start) c1 = [p1[0], p1[1] - reach]; // leaves the bottom edge heading up
    if (i === last && vertical.end) c2 = [p2[0], p2[1] + reach]; // arrives at the top edge heading up
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

/** A small repeatable pseudo-random number from a zone and a slot, so the scenery never changes between visits. */
const noise = (zone: number, slot: number): number => {
  const v = Math.sin(zone * 127.1 + slot * 311.7) * 43758.5453;
  return v - Math.floor(v);
};

@Component({
  selector: 'app-level-map',
  imports: [RouterLink, Glyph, Sheet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="top">
      <a class="round" href="/" aria-label="Back" (click)="nav.up($event)">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
      </a>
      <div class="title">
        <h1>{{ info()?.name }}@if (variantName()) { <span class="variant">· {{ variantName() }}</span> }</h1>
        <p class="muted">Level {{ frontier() }} · {{ solvedCount() }} solved</p>
      </div>
      <a class="round" [routerLink]="['/ranks']" [queryParams]="{ game: game(), kind: 'practice' }" aria-label="Leaderboard">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 20V11M12 20V4M17 20v-6" /></svg>
      </a>
    </header>

    <div class="map" [style.--hue]="info()?.hue">
      @for (zone of zones(); track zone.index) {
        <section class="zone" [style.--zh]="zone.hue" [attr.aria-label]="'Levels ' + (zone.index * 10 + 1) + ' to ' + (zone.index * 10 + 10)">
          <div class="banner">
            <span>Zone {{ zone.index + 1 }}</span>
            <b>{{ zone.name }}</b>
            <i [style.--p]="zone.done"></i>
          </div>
          <svg class="ground" viewBox="0 0 360 920" aria-hidden="true">
            <path class="road-edge" [attr.d]="zone.path" />
            <path class="road" [attr.d]="zone.path" />
            <path class="dash" [attr.d]="zone.path" />
          </svg>
          @for (d of zone.decor; track $index) {
            <svg class="decor" [class]="d.kind" viewBox="0 0 40 40" aria-hidden="true" [style.left.%]="(d.x / 360) * 100" [style.top.%]="(d.y / 920) * 100" [style.--s]="d.s">
              @switch (d.kind) {
                @case ('tree') {
                  <rect x="18" y="24" width="4" height="12" rx="1.5" class="trunk" />
                  <ellipse cx="20" cy="17" rx="11" ry="13" class="leaf" />
                  <ellipse cx="16" cy="13" rx="4" ry="5" class="shine" />
                }
                @case ('bush') {
                  <circle cx="13" cy="27" r="8" class="leaf" />
                  <circle cx="24" cy="25" r="10" class="leaf" />
                  <circle cx="21" cy="22" r="4" class="shine" />
                }
                @case ('cloud') {
                  <path d="M8 28a7 7 0 0 1 2-13.6 9 9 0 0 1 17-1A8 8 0 0 1 33 28z" class="cloud" />
                }
                @case ('rock') {
                  <path d="M6 32l5-13 9-5 11 6 4 12z" class="rock" />
                  <path d="M12 21l7-4 6 3" class="shine" />
                }
                @case ('flower') {
                  <path d="M20 36V22" class="stem" />
                  <circle cx="20" cy="17" r="3" class="core" />
                  <circle cx="20" cy="10" r="4" class="petal" /><circle cx="27" cy="17" r="4" class="petal" /><circle cx="20" cy="24" r="4" class="petal" /><circle cx="13" cy="17" r="4" class="petal" />
                  <circle cx="20" cy="17" r="3" class="core" />
                }
              }
            </svg>
          }
          @for (n of zone.nodes; track n.level) {
            <div class="spot" [style.left.%]="(n.x / 360) * 100" [style.top.%]="(n.y / 920) * 100">
              @if (n.state === 'now') {
                <span class="you" aria-hidden="true"><app-glyph [game]="game()" /></span>
              }
              <button
                type="button"
                class="node"
                [class.done]="n.state === 'done'"
                [class.now]="n.state === 'now'"
                [class.locked]="n.state === 'locked'"
                [class.hard]="n.hard"
                [attr.aria-label]="'Level ' + n.level + (n.state === 'locked' ? ', locked' : n.state === 'done' ? ', ' + n.stars + ' stars' : n.state === 'now' ? ', your next level' : '')"
                [attr.data-now]="n.state === 'now' ? '' : null"
                (click)="pick(n.level)"
              >
                @if (n.state === 'locked') {
                  <svg class="lock" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
                } @else {
                  {{ n.level }}
                }
                @if (n.hard) {
                  <svg class="flame" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 4 5 5.5 5 10.5A5 5 0 0 1 7 13c0-2 1-3 2-4 .3 1.5 1 2.2 2 2.5C10.5 8 10.5 5 12 2z" /></svg>
                }
              </button>
              @if (n.state === 'done') {
                <span class="stars" aria-hidden="true">
                  @for (s of [1, 2, 3]; track s) {
                    <svg viewBox="0 0 24 24" [class.on]="s <= n.stars"><path d="M12 2.8l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.6l-5.8 3.1 1.1-6.5L2.6 9.6l6.5-.9z" /></svg>
                  }
                </span>
              }
            </div>
          }
        </section>
      }
      <p class="more muted">{{ moreText() }}</p>
    </div>

    <a class="play" [routerLink]="playLink()" [queryParams]="{ level: frontier() }">Play level {{ frontier() }}</a>

    @if (picked(); as p) {
      <app-sheet [label]="'Level ' + p.level" (closed)="picked.set(null)">
        <div class="info">
          <div class="badge" [class.hard]="p.hard">{{ p.level }}</div>
          <h2>Level {{ p.level }}</h2>
          <p class="chip" [attr.data-d]="p.difficulty">{{ p.difficulty }}</p>
          @if (p.locked) {
            <p class="muted">Solve level {{ frontier() }} first to open this one.</p>
            <button type="button" (click)="playFrontier()">Go to level {{ frontier() }}</button>
          } @else {
            <div class="big-stars" role="img" [attr.aria-label]="p.stars + ' of 3 stars'">
              @for (s of [1, 2, 3]; track s) {
                <svg viewBox="0 0 24 24" [class.on]="s <= p.stars"><path d="M12 2.8l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.6l-5.8 3.1 1.1-6.5L2.6 9.6l6.5-.9z" /></svg>
              }
            </div>
            @if (p.best !== null) {
              <p class="muted">Best time {{ fmt(p.best) }}. Three stars under {{ fmt(p.par) }}.</p>
            } @else {
              <p class="muted">Three stars for solving it in under {{ fmt(p.par) }}.</p>
            }
            <button type="button" (click)="play(p.level)">{{ p.best !== null ? 'Play again' : 'Play' }}</button>
          }
        </div>
      </app-sheet>
    }
  `,
  styleUrl: './level-map.scss',
})
export class LevelMap {
  protected readonly nav = inject(BackService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly practice = inject(PracticeStore);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly params = toSignal(this.route.paramMap);

  protected readonly game = computed<PuzzleGameId>(() => {
    const id = this.params()?.get('game') ?? '';
    return isPuzzleGame(id) ? id : 'queens';
  });
  protected readonly variant = computed(() => this.params()?.get('variant') ?? null);
  /** What practice progress and levels are stored under. */
  private readonly track = computed(() => trackOf(this.game(), this.variant()));
  protected readonly info = computed(() => gameInfo(this.game()));
  /** How many levels this track has (a Sudoku tier has fewer than the other games). */
  private readonly count = computed(() => levelCountOf(this.track()));
  /** "Classic · Easy" for a tier, "Mini" for a plain kind. */
  protected readonly variantName = computed(() => {
    const id = this.variant();
    if (!id) return null;
    const kinds = variantsOf(this.game());
    const direct = kinds.find((v) => v.id === id);
    if (direct) return direct.name;
    const kind = kinds.find((v) => v.tiered && id.startsWith(`${v.id}-`));
    const tier = TIERS.find((t) => kind && id === `${kind.id}-${t.id}`);
    return kind && tier ? `${kind.name} · ${tier.name}` : id;
  });
  protected readonly backLink = computed(() => (this.variant() ? ['/games', this.game()] : ['/practice']));
  protected readonly playLink = computed(() => playLink(this.game(), this.variant()));
  private readonly levels = signal<unknown[]>([]);
  protected readonly picked = signal<{ level: number; hard: boolean; difficulty: string; locked: boolean; stars: number; best: number | null; par: number } | null>(null);
  private readonly ready = signal(false);

  protected readonly solvedCount = computed(() => (this.ready() ? this.practice.solvedLevels(this.track())().size : 0));
  protected readonly frontier = computed(() => (this.ready() ? this.practice.frontier(this.track()) : 1));

  /** Zones shown: every one up to the current level's, and a few locked ones beyond so the road visibly goes on. */
  protected readonly zones = computed<ZoneView[]>(() => {
    if (!this.ready()) return [];
    const game = this.game();
    const track = this.track();
    const frontier = this.frontier();
    const solved = this.practice.solvedLevels(track)();
    const levels = this.levels();
    const lastZone = Math.min(this.count() / ZONE_SIZE - 1, Math.floor((frontier - 1) / ZONE_SIZE) + 2);
    const zones: ZoneView[] = [];
    for (let z = lastZone; z >= Math.max(0, lastZone - MAX_ZONES + 1); z--) {
      const first = z * ZONE_SIZE + 1;
      const nodes: NodeView[] = [];
      const pts: [number, number][] = [];
      if (first > 1) pts.push([crossingX(first - 1), H]);
      for (let i = 0; i < ZONE_SIZE; i++) {
        const level = first + i;
        const y = H - (i + 0.5) * GAP;
        const x = xOf(level);
        pts.push([x, y]);
        const isDone = solved.has(level);
        const best = this.practice.bestMs(track, level);
        const puzzle = levels[level - 1];
        nodes.push({
          level,
          x,
          y,
          state: isDone ? 'done' : level === frontier ? 'now' : level < frontier ? 'open' : 'locked',
          hard: i === ZONE_SIZE - 1,
          stars: isDone && puzzle ? Math.min(this.practice.isHinted(track, level) ? 2 : 3, starsFor(best, parMs(game, puzzle)) || 1) : 0,
        });
      }
      const lastLevel = first + ZONE_SIZE - 1;
      if (lastLevel < this.count()) pts.push([crossingX(lastLevel), 0]);
      zones.push({
        index: z,
        name: ZONE_NAMES[z % ZONE_NAMES.length] + (z >= ZONE_NAMES.length ? ' ' + (Math.floor(z / ZONE_NAMES.length) + 1) : ''),
        hue: (140 + z * 47) % 360,
        nodes,
        path: smooth(pts, { start: first > 1, end: lastLevel < this.count() }),
        decor: this.decorFor(z, nodes),
        done: nodes.filter((n) => n.state === 'done').length / ZONE_SIZE,
      });
    }
    return zones;
  });

  protected readonly moreText = computed(() => {
    const frontier = this.frontier();
    return frontier >= this.count() ? 'You reached the last level. More are on the way.' : `${this.count() - this.solvedCount()} levels still to go. Solve a level to open the next.`;
  });

  constructor() {
    void (async () => {
      await this.practice.load(this.track());
      // Load the packs of levels the map shows (the latest zones, up to a few beyond the current level).
      const frontier = this.practice.frontier(this.track());
      const lastLevel = Math.min(this.count(), (Math.floor((frontier - 1) / ZONE_SIZE) + 3) * ZONE_SIZE);
      const firstLevel = Math.max(1, lastLevel - MAX_ZONES * ZONE_SIZE + 1);
      const levels: unknown[] = [];
      try {
        for (let pack = packOf(firstLevel); pack <= packOf(lastLevel); pack++) {
          (await loadPack(this.track(), pack)).forEach((puzzle, i) => (levels[pack * PACK_SIZE + i] = puzzle));
        }
      } catch {
        /* offline and never opened: the map still works, stars just use a default par */
      }
      this.levels.set(levels);
      this.ready.set(true);
    })();
    afterNextRender(() => {
      // Wait for the zones to exist, then bring the current level into view.
      const wait = setInterval(() => {
        const now = this.host.nativeElement.querySelector('[data-now]');
        if (!now) return;
        clearInterval(wait);
        now.scrollIntoView({ block: 'center' });
      }, 60);
      setTimeout(() => clearInterval(wait), 3000);
    });
  }

  private decorFor(zone: number, nodes: NodeView[]): Decor[] {
    const kinds: Decor['kind'][] = ['tree', 'bush', 'cloud', 'rock', 'flower'];
    const out: Decor[] = [];
    for (let slot = 0; slot < 9; slot++) {
      const y = TOP + 40 + ((slot + noise(zone, slot)) / 9) * (ZONE_H - 80);
      // Place the scenery on whichever side the road is not.
      const near = nodes.reduce((best, n) => (Math.abs(n.y - y) < Math.abs(best.y - y) ? n : best), nodes[0]);
      const left = near.x > W / 2;
      const x = left ? 28 + noise(zone, slot + 20) * 70 : W - 28 - noise(zone, slot + 20) * 70;
      const kind = kinds[Math.floor(noise(zone, slot + 40) * kinds.length)];
      out.push({ kind, x, y, s: 0.9 + noise(zone, slot + 60) * 0.7 });
    }
    return out;
  }

  protected fmt(ms: number): string {
    return formatDuration(ms);
  }

  protected pick(level: number): void {
    const game = this.track();
    const puzzle = this.levels()[level - 1];
    const locked = level > this.frontier();
    const best = this.practice.bestMs(game, level);
    const par = puzzle ? parMs(this.game(), puzzle) : 60_000;
    this.picked.set({ level, hard: (level - 1) % ZONE_SIZE === ZONE_SIZE - 1, difficulty: difficultyOf(level), locked, stars: this.practice.isSolved(game, level) ? Math.min(this.practice.isHinted(game, level) ? 2 : 3, starsFor(best, par) || 1) : 0, best, par });
  }

  protected play(level: number): void {
    this.picked.set(null);
    void this.router.navigate(playLink(this.game(), this.variant()), { queryParams: { level } });
  }

  protected playFrontier(): void {
    this.play(this.frontier());
  }
}
