import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, output, signal } from '@angular/core';
import { HapticsService } from '../../core/haptics.service';
import { PlayScreen } from '../../shared/play-screen';
import { MindResult, useTimers } from './mind-util';
import { advance, buildYard, gapMs, planTrains, segmentMs, shapeForRound, spawn, Train, trainsInRound, Yard } from './switchyard-engine';

const W = 100;
const H = 130;
const TOP = 16;
const BOTTOM = 14;
/** A symbol for each colour too, so the trains can be told apart without seeing the colours. */
export const SYMBOLS = ['●', '■', '▲', '◆'] as const;
const LIVES = 3;
/** Milliseconds from the start of a round to the first train. */
const LEAD_IN = 2400;

/**
 * Switchyard: coloured trains roll in from the top of a rail yard. Tap a switch (a round hub where the track forks) to choose which way
 * the trains go; joiners merge two tracks into one. Each train has to arrive at the station of its own colour. A train at the wrong
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
  protected readonly yard = signal<Yard>(buildYard(shapeForRound(1)));
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

  protected readonly nodes = computed(() => {
    const yard = this.yard();
    return yard.nodes.map((n) => ({ ...n, x: (W * (n.row + 0.5)) / n.width, y: TOP + (n.layer * (H - TOP - BOTTOM)) / Math.max(1, yard.layers - 1) }));
  });

  protected readonly edges = computed(() => {
    const nodes = this.nodes();
    const settings = this.settings();
    const out: { key: string; x1: number; y1: number; x2: number; y2: number; on: boolean }[] = [];
    for (const n of nodes) {
      n.next.forEach((to, k) => {
        const t = nodes[to];
        out.push({ key: `${n.id}-${to}`, x1: n.x, y1: n.y, x2: t.x, y2: t.y, on: n.next.length === 1 || (settings[n.id] ?? 0) === k });
      });
    }
    return out;
  });

  protected readonly trainViews = computed(() => {
    const nodes = this.nodes();
    return this.trains().map((t) => {
      const a = nodes[t.from];
      const b = nodes[t.to];
      return { id: t.id, colour: t.colour, x: a.x + (b.x - a.x) * t.f, y: a.y + (b.y - a.y) * t.f };
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
    const yard = buildYard(shapeForRound(round));
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
    const df = dt / segmentMs(round);
    const settings = this.settings();
    for (const train of [...this.live]) {
      const station = advance(yard, settings, train, df);
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
