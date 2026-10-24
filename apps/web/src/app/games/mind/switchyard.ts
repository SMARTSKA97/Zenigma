import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, inject, output, signal, viewChild } from '@angular/core';
import { HapticsService } from '../../core/haptics.service';
import { PlayScreen } from '../../shared/play-screen';
import { MindResult, seeded, useTimers } from './mind-util';
import {
  advance,
  branchesFor,
  buildYard,
  destinationOf,
  Edge,
  gapMs,
  liveTracks,
  offsetPts,
  planTrains,
  Pt,
  pointAt,
  roundedPath,
  spawn,
  speedFor,
  Train,
  trainsInRound,
  Yard,
} from './switchyard-engine';

/** The board is at least this many units wide; the main line runs down its middle. */
const MIN_W = 120;
const TOP = 16;
const PAD_BOTTOM = 16;
/** Pixels kept for the queue and the note above and below the yard. */
const RESERVE = 100;
/** A symbol for each colour too, so the trains can be told apart without seeing the colours. */
export const SYMBOLS = ['●', '■', '▲', '◆', '★'] as const;
export const PALETTE = ['#e5484d', '#3b82f6', '#22a559', '#f5a524', '#8b5cf6'] as const;
const LIVES = 3;
/** Milliseconds from the start of a round to the first train. */
const LEAD_IN = 2400;
/** The most pixels the canvas may have: phones are far below it, and a big desktop window is drawn a little softer instead of slowly. */
const MAX_PIXELS = 1_500_000;

interface Puff {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  r: number;
  grey: number;
}
interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  colour: string;
  r: number;
}
interface Ring {
  x: number;
  y: number;
  age: number;
  life: number;
  size: number;
  colour: string;
}
interface Pop {
  x: number;
  y: number;
  age: number;
  text: string;
  colour: string;
}
/** A train that has reached a station: it rolls into the depot and shrinks away, or (the wrong one) stops short, jolts and smokes. */
interface Landing {
  colour: number;
  x: number;
  y: number;
  angle: number;
  age: number;
  ok: boolean;
  node: number;
}
interface Shown {
  angle: number;
  born: number;
}

/**
 * Switchyard: coloured trains roll in from the tunnel at the top of a toy railway. Tap a switch (a round lantern where the track forks)
 * to choose which way the trains go; sidings rejoin the main line. Each train has to arrive at the station of its own colour. A train at
 * the wrong station costs a life (three lives). Every round has more trains, closer together, and faster, and the yards get bigger.
 *
 * It is drawn on a canvas, so the trains glide at the same speed on every track and nothing is re-rendered by the page while they move.
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
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('yard');

  protected readonly symbols = SYMBOLS;
  protected readonly hearts = Array.from({ length: LIVES }, (_, i) => i);
  protected readonly round = signal(1);
  protected readonly lives = signal(LIVES);
  protected readonly delivered = signal(0);
  protected readonly yard = signal<Yard>(buildYard(branchesFor(1)));
  /** Which way each switch points (0 or 1), by node. A signal so the screen-reader buttons stay up to date. */
  protected readonly settings = signal<number[]>([]);
  /** The colours of the trains that have not come in yet, next first. */
  protected readonly waiting = signal<number[]>([]);
  protected readonly note = signal('Tap a switch to choose where the trains go.');
  /** The room the yard has, in pixels (the play area minus the queue and the note). */
  protected readonly area = signal({ w: 360, h: 520 });
  protected readonly hurt = signal(false);

  private plan: number[] = [];
  private entered = 0;
  private clock = 0;
  private nextId = 1;
  private live: Train[] = [];
  private shown = new Map<number, Shown>();
  private landings: Landing[] = [];
  private puffs: Puff[] = [];
  private sparks: Spark[] = [];
  private rings: Ring[] = [];
  private pops: Pop[] = [];
  /** Per station: seconds since a train landed there and whether it was right (for the bounce or the shake). */
  private reaction = new Map<number, { age: number; ok: boolean }>();
  /** Per switch: how far the lantern's pointer has turned toward where it is set (eased), and a flash when a train just passed. */
  private dial = new Map<number, { a: number; flash: number }>();
  private running = false;
  private ended = false;
  private frame = 0;
  private last = 0;
  private time = 0;
  private banner: { text: string; age: number } | null = null;
  private flash = 0;

  // Layout, in units. `s` is pixels per unit, `cx` the middle of the board, `k` the stretch of the board down the page.
  private s = 3;
  private cx = 60;
  private k = 1;
  private cssW = 360;
  private cssH = 520;
  private dpr = 1;
  private tracks: { edge: Edge; bed: Path2D; left: Path2D; right: Path2D }[] = [];
  private still: HTMLCanvasElement | null = null;

  constructor() {
    // The yard takes all the height the play area has, and follows it when the phone turns or the window changes.
    afterNextRender(() => {
      const body = this.host.nativeElement.querySelector<HTMLElement>('.body');
      if (!body) return;
      const measure = (): void => {
        const next = { w: Math.max(200, body.clientWidth), h: Math.max(240, body.clientHeight - RESERVE) };
        const old = this.area();
        if (Math.abs(next.w - old.w) < 1 && Math.abs(next.h - old.h) < 1) return;
        this.area.set(next);
        // Let the sized canvas settle, then lay the board out again.
        requestAnimationFrame(() => this.layout());
      };
      measure();
      this.layout();
      const watch = new ResizeObserver(measure);
      watch.observe(body);
      this.destroy.onDestroy(() => watch.disconnect());
    });
  }

  ngOnInit(): void {
    this.startRound();
    this.last = performance.now();
    const loop = (now: number): void => {
      // A long gap (the tab was hidden) is not a long step: the trains just wait. Up to ~15 frames a second the game keeps real time.
      const dt = Math.min(66, now - this.last);
      this.last = now;
      this.tick(dt);
      this.draw(dt / 1000);
      this.frame = requestAnimationFrame(loop);
    };
    this.frame = requestAnimationFrame(loop);
    this.destroy.onDestroy(() => {
      this.ended = true;
      cancelAnimationFrame(this.frame);
    });
  }

  // ---- the game ----

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
    this.shown.clear();
    this.landings = [];
    this.reaction.clear();
    this.dial.clear();
    this.running = true;
    if (round > 1) this.note.set(`Round ${round}: ${this.plan.length} trains, a little faster.`);
    this.banner = { text: round === 1 ? 'Get ready' : `Round ${round}`, age: 0 };
    this.layout();
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
    const n = this.yard().nodes[node];
    this.rings.push({ x: this.cx + n.v, y: TOP + n.u * this.k, age: 0, life: 0.35, size: 9, colour: 'rgba(255,236,160,0.9)' });
  }

  private tick(dt: number): void {
    if (!this.running || this.ended) return;
    const round = this.round();
    const yard = this.yard();
    this.clock += dt;
    // Trains come in one after another.
    while (this.entered < this.plan.length && this.clock >= this.entered * gapMs(round)) {
      const t = spawn(yard, this.nextId++, this.plan[this.entered], this.settings());
      this.live.push(t);
      this.shown.set(t.id, { angle: 90, born: this.time });
      this.entered++;
      this.waiting.set(this.plan.slice(this.entered));
    }
    const dist = (dt / 1000) * speedFor(round);
    const settings = this.settings();
    for (const train of [...this.live]) {
      const before = train.node;
      const station = advance(yard, settings, train, dist, this.k);
      if (train.node !== before && station === null) {
        const d = this.dial.get(train.node);
        if (d) d.flash = 1;
      }
      if (station !== null) this.arrive(train, station);
    }
    if (this.running && this.entered === this.plan.length && this.live.length === 0 && this.landings.length === 0) this.roundDone();
  }

  private arrive(train: Train, station: number): void {
    this.live = this.live.filter((t) => t !== train);
    const node = this.yard().nodes[station];
    const ok = node.colour === train.colour;
    const x = this.cx + node.v;
    const y = TOP + node.u * this.k;
    const sh = this.shown.get(train.id);
    this.shown.delete(train.id);
    this.landings.push({ colour: train.colour, x, y, angle: sh?.angle ?? 90, age: 0, ok, node: station });
    this.reaction.set(station, { age: 0, ok });
    const colour = PALETTE[train.colour];
    if (ok) {
      this.delivered.update((n) => n + 1);
      this.haptics.success();
      this.rings.push({ x, y, age: 0, life: 0.6, size: 24, colour: 'rgba(255,240,170,0.95)' }, { x, y, age: 0, life: 0.45, size: 14, colour });
      for (let i = 0; i < 16; i++) this.spark(x, y, i % 3 === 0 ? '#ffe27a' : colour, 26 + Math.random() * 40);
      this.pops.push({ x, y: y - 8, age: 0, text: '+1', colour: '#fff7c2' });
      return;
    }
    this.haptics.error();
    this.rings.push({ x, y, age: 0, life: 0.55, size: 26, colour: 'rgba(255,80,80,0.95)' });
    for (let i = 0; i < 10; i++) this.puff(x, y, 0.15 + Math.random() * 0.15, 1.4);
    for (let i = 0; i < 8; i++) this.spark(x, y, '#ff6a5c', 18 + Math.random() * 26);
    this.pops.push({ x, y: y - 8, age: 0, text: '✕', colour: '#ff8a80' });
    this.flash = 1;
    this.hurt.set(true);
    this.timers.after(450, () => this.hurt.set(false));
    this.note.set('Wrong station! Switch the track earlier next time.');
    this.lives.update((l) => l - 1);
    if (this.lives() <= 0) {
      this.running = false;
      this.banner = { text: 'Out of lives', age: 0 };
      this.timers.after(1100, () => this.finish());
    }
  }

  private roundDone(): void {
    this.running = false;
    this.note.set(`Round ${this.round()} clear!`);
    this.banner = { text: `Round ${this.round()} clear!`, age: 0 };
    this.haptics.success();
    for (let i = 0; i < 26; i++) this.spark(this.cx + (Math.random() - 0.5) * 90, TOP + 10 + Math.random() * 50, i % 2 ? '#ffe27a' : PALETTE[i % 5], 30 + Math.random() * 50);
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

  // ---- effects ----

  private puff(x: number, y: number, grey: number, size = 1): void {
    if (this.puffs.length > 80) return;
    this.puffs.push({ x, y, vx: (Math.random() - 0.5) * 7, vy: -4 - Math.random() * 5, age: 0, life: 0.7 + Math.random() * 0.5, r: (0.9 + Math.random() * 0.8) * size, grey });
  }

  private spark(x: number, y: number, colour: string, speed: number): void {
    const a = Math.random() * Math.PI * 2;
    this.sparks.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 14, age: 0, life: 0.5 + Math.random() * 0.4, colour, r: 0.6 + Math.random() * 1.1 });
  }

  // ---- layout ----

  /** Fits the board to the canvas: as wide as the play area (at least 120 units), with the main line stretched down the page to fill it. */
  private layout(): void {
    const canvas = this.canvasRef().nativeElement;
    const { w, h } = this.area();
    this.cssW = w;
    this.cssH = h;
    const yard = this.yard();
    // On a wide, short window the board is not stretched past what the height allows: it keeps its shape and the scenery fills the sides.
    this.s = Math.min(w / MIN_W, h / (yard.length * 0.9 + TOP + PAD_BOTTOM));
    this.cx = w / this.s / 2;
    const hUnits = h / this.s;
    this.k = Math.max(0.6, Math.min(3.4, (hUnits - TOP - PAD_BOTTOM) / yard.length));
    this.dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1, Math.sqrt(MAX_PIXELS / (w * h))));
    canvas.width = Math.round(w * this.dpr);
    canvas.height = Math.round(h * this.dpr);
    this.buildTracks();
    this.paintStill();
  }

  private buildTracks(): void {
    const yard = this.yard();
    const k = this.k;
    const grow = (pts: Pt[]): Pt[] => pts.map(([u, v]) => [u * k, v]);
    this.tracks = [];
    for (const n of yard.nodes) {
      for (const e of n.out) {
        this.tracks.push({
          edge: e,
          bed: new Path2D(roundedPath(grow(e.pts), this.cx, TOP)),
          left: new Path2D(roundedPath(offsetPts(grow(e.pts), 1.7), this.cx, TOP)),
          right: new Path2D(roundedPath(offsetPts(grow(e.pts), -1.7), this.cx, TOP)),
        });
      }
    }
  }

  // ---- drawing ----

  /** The parts of the picture that never move (ground, scenery, track), painted once per round and size. */
  private paintStill(): void {
    const w = this.cssW;
    const h = this.cssH;
    const c = this.still ?? document.createElement('canvas');
    this.still = c;
    c.width = Math.round(w * this.dpr);
    c.height = Math.round(h * this.dpr);
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const S = this.s * this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // Ground: a mown meadow in soft stripes under a vignette, like the felt of a toy railway table.
    const base = ctx.createLinearGradient(0, 0, 0, c.height);
    base.addColorStop(0, '#2d6a45');
    base.addColorStop(1, '#245b3b');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.setTransform(S, 0, 0, S, 0, 0);
    const wU = w / this.s;
    const hU = h / this.s;
    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    for (let y = 0; y < hU; y += 14) ctx.fillRect(0, y, wU, 7);
    const random = seeded(`switchyard-${this.round()}-${this.yard().length}`);
    // Ponds and hills in the open ground beside the tracks.
    const spread = (): { x: number; y: number } => {
      const side = random() < 0.5 ? -1 : 1;
      const reach = wU > 150 ? 58 + random() * (wU / 2 - 62) : 49 + random() * 8;
      return { x: this.cx + side * reach, y: 6 + random() * (hU - 12) };
    };
    for (let i = 0; i < (wU > 150 ? 3 : 1); i++) {
      const p = spread();
      const g = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, 10);
      g.addColorStop(0, '#5fb4d6');
      g.addColorStop(1, '#2f80a8');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 9 + random() * 3, 5 + random() * 2, random() * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
    // Trees, kept off the tracks.
    for (let i = 0; i < 26; i++) {
      const p = spread();
      const r = 2.2 + random() * 1.8;
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.arc(p.x + 0.8, p.y + 1, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1f5a34';
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2f7d48';
      ctx.beginPath();
      ctx.arc(p.x - r * 0.25, p.y - r * 0.3, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
    // Track: gravel, sleepers, rails. The tracks a train would take are lit up each frame on top of this.
    ctx.lineJoin = 'round';
    for (const t of this.tracks) {
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#3a3b33';
      ctx.lineWidth = 6.2;
      ctx.stroke(t.bed);
      ctx.lineCap = 'butt';
      ctx.strokeStyle = '#8a6a45';
      ctx.lineWidth = 5.4;
      ctx.setLineDash([0.9, 1.9]);
      ctx.stroke(t.bed);
      ctx.setLineDash([]);
      ctx.strokeStyle = '#cfd6dc';
      ctx.lineWidth = 0.9;
      ctx.stroke(t.left);
      ctx.stroke(t.right);
    }
    // A soft vignette keeps the eye on the tracks.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const v = ctx.createRadialGradient(c.width / 2, c.height / 2, Math.min(c.width, c.height) * 0.4, c.width / 2, c.height / 2, Math.max(c.width, c.height) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,10,20,0.45)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, c.width, c.height);
  }

  private draw(dt: number): void {
    const canvas = this.canvasRef().nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx || !this.still) return;
    this.time += dt;
    const yard = this.yard();
    const settings = this.settings();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.still, 0, 0);
    const S = this.s * this.dpr;
    ctx.setTransform(S, 0, 0, S, 0, 0);
    ctx.lineJoin = 'round';

    // The way the next trains would go right now glows.
    const live = liveTracks(yard, settings);
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 5);
    for (const t of this.tracks) {
      if (!live.has(t.edge)) {
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(8,24,16,0.34)';
        ctx.lineWidth = 6.2;
        ctx.stroke(t.bed);
        continue;
      }
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(255,226,130,${0.16 + 0.1 * pulse})`;
      ctx.lineWidth = 7.6;
      ctx.stroke(t.bed);
      ctx.lineCap = 'butt';
      ctx.strokeStyle = '#fff6d6';
      ctx.lineWidth = 0.9;
      ctx.stroke(t.left);
      ctx.stroke(t.right);
    }

    // Where each train is heading right now: a station shows a tick if it is the right one, a cross if not.
    const heading = new Map<number, boolean>();
    for (const t of this.live) heading.set(destinationOf(yard, t, settings), yard.nodes[destinationOf(yard, t, settings)].colour === t.colour);

    for (const n of yard.nodes) {
      const x = this.cx + n.v;
      const y = TOP + n.u * this.k;
      if (n.kind === 'station') this.drawStation(ctx, n.id, n.colour as number, x, y, heading.get(n.id));
      else if (n.kind === 'gate') this.drawGate(ctx, x, y);
      else if (n.kind === 'join') {
        ctx.fillStyle = '#3a3b33';
        ctx.beginPath();
        ctx.arc(x, y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (const n of yard.nodes) if (n.kind === 'switch') this.drawSwitch(ctx, n, settings, dt);

    // Trains, then the ones rolling into a depot, then smoke and sparks.
    for (const t of this.live) this.drawTrain(ctx, t, dt);
    this.drawLandings(ctx, dt);
    this.drawEffects(ctx, dt);
    this.drawBanner(ctx, dt);

    if (this.flash > 0) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = `rgba(255,60,60,${this.flash * 0.28})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      this.flash = Math.max(0, this.flash - dt * 2.6);
    }
  }

  private drawGate(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.fillStyle = '#6d6e60';
    ctx.strokeStyle = '#25261f';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 9.5, y + 3);
    ctx.lineTo(x - 9.5, y - 3.5);
    ctx.quadraticCurveTo(x - 9.5, y - 11, x, y - 11);
    ctx.quadraticCurveTo(x + 9.5, y - 11, x + 9.5, y - 3.5);
    ctx.lineTo(x + 9.5, y + 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#0c120e';
    ctx.beginPath();
    ctx.moveTo(x - 5.6, y + 3);
    ctx.lineTo(x - 5.6, y - 2.6);
    ctx.quadraticCurveTo(x - 5.6, y - 7.4, x, y - 7.4);
    ctx.quadraticCurveTo(x + 5.6, y - 7.4, x + 5.6, y - 2.6);
    ctx.lineTo(x + 5.6, y + 3);
    ctx.closePath();
    ctx.fill();
  }

  private drawSwitch(ctx: CanvasRenderingContext2D, n: { id: number; u: number; v: number; out: Edge[] }, settings: readonly number[], dt: number): void {
    const x = this.cx + n.v;
    const y = TOP + n.u * this.k;
    const e = n.out[settings[n.id] ? 1 : 0];
    const [u, v] = e.pts[1];
    const target = Math.atan2((u - n.u) * this.k, v - n.v);
    let d = this.dial.get(n.id);
    if (!d) this.dial.set(n.id, (d = { a: target, flash: 0 }));
    // The pointer swings to its new setting with a little overshoot.
    let diff = target - d.a;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    d.a += diff * Math.min(1, dt * 16);
    d.flash = Math.max(0, d.flash - dt * 3);
    const glow = ctx.createRadialGradient(x, y, 2, x, y, 9);
    glow.addColorStop(0, `rgba(255,236,150,${0.45 + 0.4 * d.flash})`);
    glow.addColorStop(1, 'rgba(255,236,150,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 9, y - 9, 18, 18);
    ctx.fillStyle = '#2a4a36';
    ctx.strokeStyle = '#f4f1da';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(x, y, 5.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // An arrow that points down the way the trains will go.
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(d.a);
    ctx.fillStyle = '#fff1a8';
    ctx.beginPath();
    ctx.moveTo(4.1, 0);
    ctx.lineTo(-1.2, -2.7);
    ctx.lineTo(-0.2, 0);
    ctx.lineTo(-1.2, 2.7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawStation(ctx: CanvasRenderingContext2D, id: number, colour: number, x: number, y: number, headingOk: boolean | undefined): void {
    const c = PALETTE[colour];
    const r = this.reaction.get(id);
    let sx = 1;
    let dx = 0;
    if (r) {
      r.age += 1 / 60;
      if (r.ok) sx = 1 + 0.2 * Math.max(0, Math.sin(Math.min(1, r.age / 0.5) * Math.PI)) * (1 - r.age / 0.5);
      else dx = Math.sin(r.age * 60) * 1.2 * Math.max(0, 1 - r.age / 0.5);
      if (r.age > 0.55) this.reaction.delete(id);
    }
    ctx.save();
    ctx.translate(x + dx, y);
    ctx.scale(sx, sx);
    // A halo in the colour of the depot, so the match is easy to see from a distance.
    const halo = ctx.createRadialGradient(0, 0, 4, 0, 0, 15);
    halo.addColorStop(0, `${c}55`);
    halo.addColorStop(1, `${c}00`);
    ctx.fillStyle = halo;
    ctx.fillRect(-15, -15, 30, 30);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    this.rr(ctx, -8.4 + 0.8, -5.4 + 1.2, 16.8, 12.4, 1.6);
    ctx.fill();
    ctx.fillStyle = '#f3ecd8';
    this.rr(ctx, -8.4, -5.4, 16.8, 12.4, 1.6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(-10, -5);
    ctx.lineTo(0, -12.6);
    ctx.lineTo(10, -5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    this.rr(ctx, -2.6, 1.6, 5.2, 5.4, 0.8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, -4.4, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c;
    ctx.font = '800 4.4px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(SYMBOLS[colour], 0, -4.2);
    ctx.restore();
    if (headingOk !== undefined) {
      // The next train for this station: a tick if it will land right, a cross if it will not.
      const bob = Math.sin(this.time * 6) * 0.35;
      ctx.fillStyle = headingOk ? '#22c55e' : '#ef4444';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.arc(x + 8.6, y - 9.4 + bob, 2.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 0.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      if (headingOk) {
        ctx.moveTo(x + 7.4, y - 9.4 + bob);
        ctx.lineTo(x + 8.3, y - 8.4 + bob);
        ctx.lineTo(x + 10, y - 10.6 + bob);
      } else {
        ctx.moveTo(x + 7.6, y - 10.4 + bob);
        ctx.lineTo(x + 9.6, y - 8.4 + bob);
        ctx.moveTo(x + 9.6, y - 10.4 + bob);
        ctx.lineTo(x + 7.6, y - 8.4 + bob);
      }
      ctx.stroke();
    }
  }

  private rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /** The train where it is, a hair behind and ahead of it averaged, so corners are rounded the way the track is. */
  private placeOf(t: Train): { x: number; y: number; angle: number } {
    const k = this.k;
    const a = pointAt(t.edge, t.d - 2.2, k);
    const b = pointAt(t.edge, t.d + 2.2, k);
    const x = this.cx + (a.v + b.v) / 2;
    const y = TOP + ((a.u + b.u) / 2) * k;
    const dx = b.v - a.v;
    const dy = (b.u - a.u) * k;
    const angle = dx === 0 && dy === 0 ? pointAt(t.edge, t.d, k).angle : (Math.atan2(dy, dx) * 180) / Math.PI;
    return { x, y, angle };
  }

  private drawTrain(ctx: CanvasRenderingContext2D, t: Train, dt: number): void {
    const p = this.placeOf(t);
    const sh = this.shown.get(t.id) ?? { angle: p.angle, born: this.time };
    this.shown.set(t.id, sh);
    // Turn smoothly (the shortest way round) rather than snapping at a corner.
    let diff = p.angle - sh.angle;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    sh.angle += diff * Math.min(1, dt * 14);
    const alpha = Math.min(1, (this.time - sh.born) / 0.25);
    // Smoke from the stack.
    if (Math.random() < dt * 14) {
      const rad = (sh.angle * Math.PI) / 180;
      this.puff(p.x + Math.cos(rad) * 7.3, p.y + Math.sin(rad) * 7.3, 0.82, 1);
    }
    this.paintTrain(ctx, t.colour, p.x, p.y, sh.angle, alpha, 1);
  }

  private paintTrain(ctx: CanvasRenderingContext2D, colour: number, x: number, y: number, angle: number, alpha: number, scale: number): void {
    const c = PALETTE[colour];
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.rotate((angle * Math.PI) / 180);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    this.rr(ctx, -9.8, -2.3, 20.4, 7, 2);
    ctx.fill();
    ctx.fillStyle = '#1b1b1b';
    for (const [wx, wy] of [[-9.4, -3.9], [-9.4, 2.8], [-5.4, -3.9], [-5.4, 2.8], [-0.4, -3.9], [-0.4, 2.8], [4.6, -3.9], [4.6, 2.8]]) ctx.fillRect(wx, wy, 2.6, 1.1);
    // Wagon.
    ctx.fillStyle = c;
    this.rr(ctx, -10, -3.2, 7.8, 6.4, 1.1);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 0.45;
    ctx.beginPath();
    for (const rx of [-8.3, -6.1, -3.9]) {
      ctx.moveTo(rx, -2.6);
      ctx.lineTo(rx, 2.6);
    }
    ctx.stroke();
    ctx.fillStyle = '#222';
    ctx.fillRect(-2.3, -0.45, 1.5, 0.9);
    // Locomotive.
    ctx.fillStyle = c;
    this.rr(ctx, -0.8, -3.2, 10, 6.4, 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    this.rr(ctx, 3, -2.4, 5.8, 4.8, 2.2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    this.rr(ctx, -0.8, -3.2, 3.6, 6.4, 1);
    ctx.fill();
    ctx.fillStyle = '#bfe3f5';
    ctx.fillRect(0.7, -2.5, 1.5, 1.5);
    ctx.fillRect(0.7, 1, 1.5, 1.5);
    ctx.fillStyle = '#e9b949';
    ctx.beginPath();
    ctx.arc(4.9, 0, 0.95, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(7.3, 0, 1.25, 0, Math.PI * 2);
    ctx.fill();
    // Headlamp with a glow.
    const lamp = ctx.createRadialGradient(9.2, 0, 0.2, 9.2, 0, 3.4);
    lamp.addColorStop(0, 'rgba(255,243,160,0.95)');
    lamp.addColorStop(1, 'rgba(255,243,160,0)');
    ctx.fillStyle = lamp;
    ctx.fillRect(5.8, -3.4, 6.8, 6.8);
    // The symbol on the wagon stays upright.
    ctx.rotate((-angle * Math.PI) / 180);
    ctx.rotate(0);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(Math.cos((angle * Math.PI) / 180) * -6.1, Math.sin((angle * Math.PI) / 180) * -6.1, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c;
    ctx.font = '800 3.4px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(SYMBOLS[colour], Math.cos((angle * Math.PI) / 180) * -6.1, Math.sin((angle * Math.PI) / 180) * -6.1 + 0.2);
    ctx.restore();
  }

  /** A train that arrived: right, it rolls into the depot and shrinks away; wrong, it stops short with a jolt and crumples. */
  private drawLandings(ctx: CanvasRenderingContext2D, dt: number): void {
    for (const l of this.landings) {
      l.age += dt;
      const life = l.ok ? 0.45 : 0.75;
      const t = Math.min(1, l.age / life);
      if (l.ok) this.paintTrain(ctx, l.colour, l.x, l.y + t * 3, l.angle, 1 - t, 1 - 0.45 * t);
      else {
        const wob = Math.sin(l.age * 38) * (1 - t) * 6;
        this.paintTrain(ctx, l.colour, l.x, l.y, l.angle + wob, 1 - t * t, 1 + 0.12 * Math.sin(t * Math.PI));
      }
    }
    this.landings = this.landings.filter((l) => l.age < (l.ok ? 0.45 : 0.75));
  }

  private drawEffects(ctx: CanvasRenderingContext2D, dt: number): void {
    for (const p of this.puffs) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const t = p.age / p.life;
      ctx.globalAlpha = Math.max(0, 0.55 * (1 - t));
      ctx.fillStyle = `rgb(${Math.round(255 * p.grey)},${Math.round(255 * p.grey)},${Math.round(255 * p.grey)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (1 + t * 1.6), 0, Math.PI * 2);
      ctx.fill();
    }
    this.puffs = this.puffs.filter((p) => p.age < p.life);
    for (const s of this.sparks) {
      s.age += dt;
      s.vy += 60 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      ctx.globalAlpha = Math.max(0, 1 - s.age / s.life);
      ctx.fillStyle = s.colour;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    this.sparks = this.sparks.filter((s) => s.age < s.life);
    for (const r of this.rings) {
      r.age += dt;
      const t = Math.min(1, r.age / r.life);
      ctx.globalAlpha = Math.max(0, 1 - t);
      ctx.strokeStyle = r.colour;
      ctx.lineWidth = 1.6 * (1 - t) + 0.3;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.size * (1 - (1 - t) ** 3), 0, Math.PI * 2);
      ctx.stroke();
    }
    this.rings = this.rings.filter((r) => r.age < r.life);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 7px system-ui, sans-serif';
    for (const p of this.pops) {
      p.age += dt;
      ctx.globalAlpha = Math.max(0, 1 - p.age / 0.9);
      ctx.fillStyle = p.colour;
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 0.8;
      ctx.strokeText(p.text, p.x, p.y - p.age * 14);
      ctx.fillText(p.text, p.x, p.y - p.age * 14);
    }
    this.pops = this.pops.filter((p) => p.age < 0.9);
    ctx.globalAlpha = 1;
  }

  private drawBanner(ctx: CanvasRenderingContext2D, dt: number): void {
    const b = this.banner;
    if (!b) return;
    b.age += dt;
    if (b.age > 1.6) {
      this.banner = null;
      return;
    }
    const t = b.age / 1.6;
    const pop = t < 0.15 ? t / 0.15 : 1;
    ctx.globalAlpha = t > 0.7 ? Math.max(0, 1 - (t - 0.7) / 0.3) : 1;
    ctx.font = '800 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const y = TOP + 34;
    ctx.save();
    ctx.translate(this.cx, y);
    ctx.scale(0.8 + 0.2 * pop, 0.8 + 0.2 * pop);
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = 'rgba(0,20,10,0.7)';
    ctx.strokeText(b.text, 0, 0);
    ctx.fillStyle = '#fff7c2';
    ctx.fillText(b.text, 0, 0);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /** The pointer lands on the nearest switch in reach: forgiving, so a thumb does not have to be exact. */
  protected tap(event: PointerEvent): void {
    if (this.ended) return;
    const box = this.canvasRef().nativeElement.getBoundingClientRect();
    const ux = (event.clientX - box.left) / this.s;
    const uy = (event.clientY - box.top) / this.s;
    let best = -1;
    let bestD = 13;
    for (const n of this.yard().nodes) {
      if (n.kind !== 'switch') continue;
      const d = Math.hypot(this.cx + n.v - ux, TOP + n.u * this.k - uy);
      if (d < bestD) {
        bestD = d;
        best = n.id;
      }
    }
    if (best >= 0) this.flip(best, event);
  }

  protected readonly switches = (): number[] => this.yard().nodes.filter((n) => n.kind === 'switch').map((n) => n.id);
}
