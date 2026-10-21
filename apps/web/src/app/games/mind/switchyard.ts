import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, output, signal } from '@angular/core';
import { HapticsService } from '../../core/haptics.service';
import { PlayScreen } from '../../shared/play-screen';
import { MindResult, useTimers } from './mind-util';
import { advance, branchesFor, buildYard, Edge, gapMs, liveTracks, offsetPts, planTrains, pointAt, roundedPath, spawn, speedFor, Train, trainsInRound, Yard } from './switchyard-engine';

/** Width of the board in units; the main line runs down its middle. */
const W = 120;
const CX = W / 2;
const TOP = 16;
const PAD_BOTTOM = 16;
/** A symbol for each colour too, so the trains can be told apart without seeing the colours. */
export const SYMBOLS = ['●', '■', '▲', '◆', '★'] as const;
const LIVES = 3;
/** Milliseconds from the start of a round to the first train. */
const LEAD_IN = 2400;
/** Little trees at the edges of the board: fixed, so the scenery does not jump about. */
const TREES = [[6, 12, 3.4], [114, 22, 3], [5, 44, 2.6], [115, 58, 3.6], [7, 80, 3], [113, 96, 2.8], [6, 118, 3.4], [114, 132, 3]] as const;

/**
 * Switchyard: coloured trains roll in from the top of a rail yard. Tap a switch (a round hub where the track forks) to choose which way
 * the trains go; sidings rejoin the main line. Each train has to arrive at the station of its own colour. A train at the wrong
 * station costs a life (three lives). Every round has more trains, closer together, and faster, and the yards get bigger.
 */
@Component({
  selector: 'app-switchyard',
  imports: [PlayScreen],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./mind.scss', './switchyard.scss'],
  templateUrl: './switchyard.html',
})
export class Switchyard implements OnInit {
  readonly done = output<MindResult>();
  private readonly haptics = inject(HapticsService);
  private readonly timers = useTimers();
  private readonly destroy = inject(DestroyRef);

  protected readonly symbols = SYMBOLS;
  protected readonly hearts = Array.from({ length: LIVES }, (_, i) => i);
  protected readonly round = signal(1);
  protected readonly lives = signal(LIVES);
  protected readonly delivered = signal(0);
  protected readonly yard = signal<Yard>(buildYard(branchesFor(1)));
  /** Which way each switch points (0 or 1), by node. */
  protected readonly settings = signal<number[]>([]);
  protected readonly trains = signal<Train[]>([]);
  /** The colours of the trains that have not come in yet, next first. */
  protected readonly waiting = signal<number[]>([]);
  protected readonly note = signal('Tap a switch to choose where the trains go.');
  /** The station a train just reached, and whether it was the right one (for a short flash). */
  protected readonly arrival = signal<{ node: number; ok: boolean; key: number } | null>(null);

  private plan: number[] = [];
  private entered = 0;
  private clock = 0;
  private nextId = 1;
  private live: Train[] = [];
  private running = false;
  private ended = false;
  private frame = 0;
  private last = 0;
  private arrivals = 0;

  protected readonly height = computed(() => this.yard().length + TOP + PAD_BOTTOM);
  protected readonly trees = TREES;

  protected readonly nodes = computed(() => this.yard().nodes.map((n) => ({ ...n, x: CX + n.v, y: TOP + n.u })));

  /** Each track drawn as gravel, sleepers and two rails; the ones a train would take right now are lit. */
  protected readonly tracks = computed(() => {
    const yard = this.yard();
    const live = liveTracks(yard, this.settings());
    const out: { key: string; bed: string; left: string; right: string; live: boolean }[] = [];
    for (const n of yard.nodes) {
      n.out.forEach((e: Edge, k) => {
        out.push({
          key: `${n.id}-${k}`,
          bed: roundedPath(e.pts, CX, TOP),
          left: roundedPath(offsetPts(e.pts, 1.7), CX, TOP),
          right: roundedPath(offsetPts(e.pts, -1.7), CX, TOP),
          live: live.has(e),
        });
      });
    }
    return out;
  });

  /** For each switch, a short stroke from its hub toward the way it is set. */
  protected readonly pointers = computed(() => {
    const settings = this.settings();
    return this.nodes()
      .filter((n) => n.out.length === 2)
      .map((n) => {
        const e = n.out[settings[n.id] ? 1 : 0];
        const [u, v] = e.pts[1];
        const du = u - n.u;
        const dv = v - n.v;
        const len = Math.hypot(du, dv) || 1;
        return { id: n.id, x: n.x + (dv / len) * 4.4, y: n.y + (du / len) * 4.4 };
      });
  });

  protected readonly trainViews = computed(() => {
    const nodes = this.nodes();
    return this.trains().map((t) => {
      const p = pointAt(t.edge, t.d);
      return { id: t.id, colour: t.colour, x: CX + p.v, y: TOP + p.u, angle: p.angle, from: nodes[t.node].id };
    });
  });

  ngOnInit(): void {
    this.startRound();
    this.last = performance.now();
    const loop = (now: number): void => {
      // A long gap (the tab was hidden) is not a long step: the trains just wait.
      const dt = Math.min(50, now - this.last);
      this.last = now;
      this.tick(dt);
      this.frame = requestAnimationFrame(loop);
    };
    this.frame = requestAnimationFrame(loop);
    this.destroy.onDestroy(() => {
      this.ended = true;
      cancelAnimationFrame(this.frame);
    });
  }

  private startRound(): void {
    const round = this.round();
    const yard = buildYard(branchesFor(round));
    this.yard.set(yard);
    this.settings.set([]);
    this.plan = planTrains(yard, trainsInRound(round));
    this.waiting.set([...this.plan]);
    this.entered = 0;
    this.clock = -LEAD_IN;
    this.live = [];
    this.trains.set([]);
    this.arrivals = 0;
    this.running = true;
    if (round > 1) this.note.set(`Round ${round}: ${this.plan.length} trains, a little faster.`);
  }

  protected flip(node: number, event?: Event): void {
    event?.preventDefault();
    if (this.ended) return;
    this.settings.update((s) => {
      const next = [...s];
      next[node] = (next[node] ?? 0) === 0 ? 1 : 0;
      return next;
    });
    this.haptics.tick();
  }

  private tick(dt: number): void {
    if (!this.running || this.ended) return;
    const round = this.round();
    const yard = this.yard();
    this.clock += dt;
    // Trains come in one after another.
    while (this.entered < this.plan.length && this.clock >= this.entered * gapMs(round)) {
      this.live.push(spawn(yard, this.nextId++, this.plan[this.entered], this.settings()));
      this.entered++;
      this.waiting.set(this.plan.slice(this.entered));
    }
    const dist = (dt / 1000) * speedFor(round);
    const settings = this.settings();
    for (const train of [...this.live]) {
      const station = advance(yard, settings, train, dist);
      if (station !== null) this.arrive(train, station);
    }
    this.trains.set([...this.live]);
    if (this.running && this.entered === this.plan.length && this.live.length === 0) this.roundDone();
  }

  private arrive(train: Train, station: number): void {
    this.live = this.live.filter((t) => t !== train);
    const ok = this.yard().nodes[station].colour === train.colour;
    const key = ++this.arrivals;
    this.arrival.set({ node: station, ok, key });
    this.timers.after(600, () => {
      if (this.arrival()?.key === key) this.arrival.set(null);
    });
    if (ok) {
      this.delivered.update((n) => n + 1);
      this.haptics.success();
      return;
    }
    this.haptics.error();
    this.note.set('Wrong station! Switch the track earlier next time.');
    this.lives.update((l) => l - 1);
    if (this.lives() <= 0) {
      this.running = false;
      this.timers.after(1000, () => this.finish());
    }
  }

  private roundDone(): void {
    this.running = false;
    this.note.set(`Round ${this.round()} clear!`);
    this.timers.after(1300, () => {
      if (this.ended) return;
      this.round.update((r) => r + 1);
      this.startRound();
    });
  }

  private finish(): void {
    if (this.ended) return;
    this.ended = true;
    cancelAnimationFrame(this.frame);
    const n = this.delivered();
    this.done.emit({ score: n, detail: `${n} ${n === 1 ? 'train' : 'trains'} delivered in ${this.round()} ${this.round() === 1 ? 'round' : 'rounds'}` });
  }
}
