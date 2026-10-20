import { BackService } from '../../core/back.service';
import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, afterNextRender, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { gameInfo, levelCountOf, TIERS, isPuzzleGame, playLink, practiceEntry, PRACTICE_TRACKS, PuzzleGameId, trackOf, variantsOf } from '../../games/catalog';
import { indiaDate } from '../../core/hints.service';
import { difficultyOf, parMs, starsFor } from '../../games/puzzle/par';
import { loadPack, packOf, PACK_SIZE } from '../../games/puzzle/level-source';
import { PracticeStore, ZONE_SIZE } from '../../games/puzzle/practice.store';
import { formatDuration } from '../../core/leaderboard.service';
import { Glyph } from '../../shared/glyph';
import { Sheet } from '../../shared/sheet';
import { SoonPill } from '../../shared/soon-pill';

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
  imports: [RouterLink, Glyph, Sheet, SoonPill],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './level-map.html',
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
  protected readonly levelCount = this.count;
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
  protected readonly backLink = computed(() => {
    const id = this.variant();
    if (!id) return ['/practice'];
    // A difficulty map goes back to its difficulty chooser; a plain kind goes back to the kind chooser.
    const kind = variantsOf(this.game()).find((v) => v.tiered && id.startsWith(`${v.id}-`));
    return kind ? ['/games', this.game(), kind.id] : ['/games', this.game()];
  });
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

  /** Within 100 levels of the end of this track (or at it): new levels are added on the next Monday, so point to other games meanwhile. */
  protected readonly nearEnd = computed(() => this.ready() && this.count() - this.frontier() < 100);
  protected readonly nextMonday = computed(() => {
    const today = new Date(`${indiaDate()}T00:00:00Z`);
    const ahead = ((8 - today.getUTCDay()) % 7) || 7; // days until the next Monday (a Monday itself counts as next week)
    return new Date(today.getTime() + ahead * 86_400_000).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' });
  });
  /** Three other games, the ones this player has played the least. */
  protected readonly elsewhere = computed(() => {
    if (!this.nearEnd()) return [];
    const games = [...new Set(PRACTICE_TRACKS.map((t) => t.game))].filter((g) => g !== this.game());
    return games
      .map((g) => ({ id: g, info: gameInfo(g), solved: PRACTICE_TRACKS.filter((t) => t.game === g).reduce((n, t) => n + this.practice.solvedLevels(t.track)().size, 0), link: practiceEntry(g) }))
      .sort((a, b) => a.solved - b.solved)
      .slice(0, 3);
  });

  protected readonly moreText = computed(() => {
    const frontier = this.frontier();
    return frontier >= this.count() ? 'You reached the last level. 100 new levels are coming.' : `${this.count() - this.solvedCount()} levels still to go. Solve a level to open the next.`;
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
