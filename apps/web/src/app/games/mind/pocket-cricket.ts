import { ChangeDetectionStrategy, Component, ElementRef, HostListener, OnDestroy, OnInit, inject, output, signal, viewChild } from '@angular/core';
import { HapticsService } from '../../core/haptics.service';
import { PlayScreen } from '../../shared/play-screen';
import { MindResult } from './mind-util';
import {
  BAT_END,
  BOWL_END,
  deliver,
  Delivery,
  FIELDERS,
  FieldPlan,
  fielderPoint,
  Match,
  MAX_BALLS,
  OUTS_TO_END,
  planField,
  playShot,
  Pt,
  rollPoint,
  ROPE,
  Running,
  RUN_SECONDS,
  Shot,
  SWEET,
} from './pocket-cricket-engine';

/** The canvas is drawn on a 360 × 480 grid and scaled to the screen (and doubled, so it stays sharp). */
const W = 360;
const H = 480;
const SCALE = 2;
/** Batting view, from behind the batter: where the pitch starts (far) and ends (near), and how wide it is at each end. */
const FAR_Y = 150;
const NEAR_Y = 470;
const HW_FAR = 13;
const HW_NEAR = 118;
const CX = W / 2;

type Phase = 'ready' | 'flight' | 'swing' | 'field' | 'result';

const hw = (y: number): number => HW_FAR + ((y - FAR_Y) / (NEAR_Y - FAR_Y)) * (HW_NEAR - HW_FAR);
/** How big things are at screen height y, compared with the near end. */
const depth = (y: number): number => hw(y) / HW_NEAR;
/** Where the ball is on the ground at flight progress p. */
const HIT_Y = NEAR_Y - 40; // the batting crease, where the ball must be when the bat comes through
const groundY = (p: number): number => FAR_Y + 10 + (p / SWEET) * (HIT_Y - FAR_Y - 10);
/** How high above the pitch the ball is (in near-end pixels): released high, pitched at 0.6, then up off the pitch. */
const height = (p: number): number => (p < 0.55 ? 70 * (1 - p / 0.55) ** 1.2 : 38 * Math.sin(Math.min(1, (p - 0.55) / 0.62) * Math.PI));

/** A fixed scatter for the wear on the pitch and the crowd, so nothing flickers. */
const rng = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const CROWD = (() => {
  const r = rng(7);
  return Array.from({ length: 260 }, () => ({ x: r() * W, y: 58 + r() * 52, c: ['#e5484d', '#f5b82e', '#f4f4f4', '#3e63dd', '#30a46c', '#d6409f'][Math.floor(r() * 6)] }));
})();
const WEAR = (() => {
  const r = rng(21);
  return Array.from({ length: 22 }, () => ({ p: r(), dx: (r() - 0.5) * 1.6, s: 0.4 + r() * 0.8, a: 0.05 + r() * 0.08 }));
})();

/**
 * A pocket cricket game in the spirit of Doodle Cricket: the batter's view from behind, one tap to swing as the ball arrives. Miss and you
 * are out; an early swing goes to the leg side and a late one to the off side. Hit it and the view cuts to the field: press Run to go
 * for runs before the fielder's throw is back (a run out is an out too), or watch a boundary or a catch. Five outs end the game.
 */
@Component({
  selector: 'app-pocket-cricket',
  imports: [PlayScreen],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./mind.scss', './pocket-cricket.scss'],
  templateUrl: './pocket-cricket.html',
})
export class PocketCricket implements OnInit, OnDestroy {
  readonly done = output<MindResult>();
  private readonly haptics = inject(HapticsService);
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('screen');

  protected readonly runs = signal(0);
  protected readonly balls = signal('0.0');
  protected readonly outs = signal(0);
  protected readonly call = signal<{ id: number; text: string; kind: string }>({ id: 0, text: 'Get ready', kind: 'info' });
  /** Which buttons show: the batting ones, the Run button after a hit that can be run, or nothing to press while a boundary or a catch plays out. */
  protected readonly pad = signal<'bat' | 'run' | 'watch'>('bat');
  protected readonly canShoot = signal(false);
  /** Instructions shown over the first ball only. */
  protected readonly hint = signal(true);
  protected readonly canRun = signal(false);
  protected readonly outList = Array.from({ length: OUTS_TO_END }, (_, i) => i);

  private view: 'bat' | 'field' = 'bat';
  private readonly match = new Match();
  private phase: Phase = 'ready';
  private t = 0;
  private flight = 0;
  private delivery: Delivery = { seconds: 1.2 };
  private swung = false;
  private swingAt = 0;
  private shot: Shot | null = null;
  private plan: FieldPlan | null = null;
  private running: Running | null = null;
  private resultFor = 0.9;
  /** How far the fielding scene had got when the ball ended, so the result hold freezes it instead of replaying it. */
  private fieldEnd = 0;
  private stumpsHit = false;
  private lastRuns = 0;
  private particles: { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number }[] = [];
  private floaters: { x: number; y: number; text: string; life: number; color: string; size: number }[] = [];
  private shake = 0;
  private flash = 0;
  private flashColor = '#ffd23f';
  private cheer = 0;
  /** The mascot's mood: 1 = cheering, -1 = glum, fading back to 0. */
  private mood = 0;
  private frame = 0;
  private last = 0;
  private clock = 0;
  private finished = false;
  private ctx!: CanvasRenderingContext2D;

  ngOnInit(): void {
    const canvas = this.canvasRef().nativeElement;
    canvas.width = W * SCALE;
    canvas.height = H * SCALE;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.scale(SCALE, SCALE);
    this.last = performance.now();
    this.frame = requestAnimationFrame((n) => this.loop(n));
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.frame);
  }

  @HostListener('document:keydown', ['$event'])
  protected key(event: KeyboardEvent): void {
    if (event.repeat) return;
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (this.phase === 'field') this.run();
      else this.hit();
    }
  }

  /** Swing the bat. */
  protected hit(): void {
    if (this.phase !== 'flight' || this.swung) return;
    this.swung = true;
    this.hint.set(false);
    this.swingAt = this.t;
    this.canShoot.set(false);
    this.haptics.tap();
    const shot = playShot(this.flight, Math.random);
    this.shot = shot;
    if (shot.outcome === 'miss') {
      this.say(this.flight < SWEET ? 'Too early!' : 'Too late!', 'miss');
      return;
    }
    this.plan = planField(shot);
    this.enter('swing');
    this.say(shot.outcome === 'six' ? 'Smashed!' : shot.outcome === 'caught' ? 'Edged!' : 'Hit!', 'hit');
    this.haptics.place();
  }

  /** Show a call on the screen; each new one pops in afresh. */
  private say(text: string, kind = 'info'): void {
    this.call.set({ id: this.call().id + 1, text, kind });
  }

  /** Tap the screen to swing, or to run once the ball is hit. */
  protected tap(): void {
    if (this.phase === 'field') this.run();
    else this.hit();
  }

  protected run(): void {
    if (this.phase !== 'field' || !this.running) return;
    this.haptics.tick();
    this.running.tap(this.t);
  }

  private enter(phase: Phase): void {
    this.phase = phase;
    this.t = 0;
    this.canShoot.set(phase === 'flight' && !this.swung);
    this.canRun.set(false);
  }

  private loop(now: number): void {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.clock += dt;
    this.update(dt);
    this.draw();
    if (!this.finished) this.frame = requestAnimationFrame((n) => this.loop(n));
  }

  private update(dt: number): void {
    this.t += dt;
    for (const p of this.particles) (p.life -= dt), (p.x += p.vx * dt), (p.y += p.vy * dt), (p.vy += 520 * dt), (p.vx *= 1 - dt * 0.8);
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const f of this.floaters) (f.life -= dt), (f.y -= 34 * dt);
    this.floaters = this.floaters.filter((f) => f.life > 0);
    this.shake = Math.max(0, this.shake - dt);
    this.flash = Math.max(0, this.flash - dt * 1.4);
    this.cheer = Math.max(0, this.cheer - dt);
    this.mood *= 1 - Math.min(1, dt * 0.9);
    switch (this.phase) {
      case 'ready':
        if (this.t >= 1.1) {
          this.delivery = deliver(Math.random);
          this.flight = 0;
          this.swung = false;
          this.shot = null;
          this.plan = null;
          this.running = null;
          this.stumpsHit = false;
          this.lastRuns = 0;
          this.say('');
          this.enter('flight');
        }
        break;
      case 'flight':
        this.flight += dt / this.delivery.seconds;
        if (this.flight >= 1.12) {
          this.haptics.error();
          this.stumpsHit = !this.swung;
          this.finishBall(0, true, this.swung ? 'Missed!' : 'Bowled!', 1.1);
        }
        break;
      case 'swing':
        if (this.t >= 0.4) this.startField();
        break;
      case 'field':
        this.updateField();
        break;
      case 'result':
        if (this.t >= this.resultFor) this.next();
        break;
    }
  }

  private startField(): void {
    const shot = this.shot!;
    const plan = this.plan!;
    this.view = 'field';
    this.enter('field');
    if (plan.kind === 'play') {
      this.running = new Running(plan.returned);
      this.pad.set('run');
      this.canRun.set(true);
      this.say('Run! Tap Run', 'run');
    } else {
      this.pad.set('watch');
      if (plan.kind === 'boundary') {
        this.say(shot.outcome === 'six' ? 'Up and away…' : 'Racing to the rope…', 'hit');
      } else {
        this.say('Up in the air…', 'hit');
      }
    }
  }

  private updateField(): void {
    const plan = this.plan!;
    const shot = this.shot!;
    if (plan.kind === 'boundary') {
      if (this.t >= plan.ballTime + 0.05) this.finishBall(shot.outcome === 'six' ? 6 : 4, false, shot.outcome === 'six' ? 'SIX!' : 'FOUR!', 1.5);
    } else if (plan.kind === 'caught') {
      if (this.t >= plan.returned) {
        this.haptics.error();
        this.finishBall(0, true, 'Caught!', 0.9);
      }
    } else if (this.running) {
      this.running.tick(this.t);
      if (this.running.runs > this.lastRuns) {
        this.lastRuns = this.running.runs;
        this.floaters.push({ x: W / 2, y: 215, text: '+1', life: 1, color: '#7CFC9A', size: 30 });
        this.haptics.tick();
      }
      if (this.running.done) {
        const r = this.running;
        if (r.out) {
          this.haptics.error();
          this.finishBall(r.runs, true, 'Run out!', 0.9);
        } else {
          this.finishBall(r.runs, false, r.runs === 0 ? 'No run' : r.runs === 1 ? '1 run' : `${r.runs} runs`, 0.7);
        }
      }
    }
  }

  private finishBall(runs: number, out: boolean, text: string, hold: number): void {
    if (this.phase === 'field') this.fieldEnd = this.t;
    this.hint.set(false);
    this.match.record(runs, out);
    this.runs.set(this.match.runs);
    this.balls.set(this.match.overs);
    this.outs.set(this.match.outs);
    const kind = out ? 'out' : runs === 6 ? 'six' : runs === 4 ? 'four' : runs > 0 ? 'run' : 'info';
    this.say(out ? `OUT! ${text}` : text, kind);
    this.celebrate(kind, runs);
    this.resultFor = hold;
    this.canRun.set(false);
    this.pad.set('watch');
    this.enter('result');
  }

  /** Confetti, flashes and a mascot's reaction for the end of a ball. */
  private celebrate(kind: string, runs: number): void {
    const palettes: Record<string, string[]> = {
      six: ['#ffd23f', '#ff7a1a', '#ffffff', '#ff3d81', '#4dd2ff'],
      four: ['#7CFC9A', '#ffffff', '#4dd2ff', '#ffd23f'],
      run: ['#7CFC9A', '#ffffff'],
      out: ['#ff5a5f', '#7a1d22'],
    };
    const palette = palettes[kind];
    if (kind === 'six' || kind === 'four') {
      this.burst(W / 2, 190, kind === 'six' ? 110 : 60, palette, kind === 'six' ? 330 : 240);
      this.burst(70, 120, 20, palette, 200);
      this.burst(W - 70, 120, 20, palette, 200);
      this.floaters.push({ x: W / 2, y: 300, text: `+${runs}`, life: 1.4, color: kind === 'six' ? '#ffd23f' : '#7CFC9A', size: 64 });
      this.flash = 0.5;
      this.flashColor = kind === 'six' ? '#ffd23f' : '#7CFC9A';
      this.cheer = 2;
      this.mood = 1;
      if (kind === 'six') (this.shake = 0.3), this.haptics.success();
      else this.haptics.place();
    } else if (kind === 'out') {
      this.burst(W / 2, 220, 24, palette, 160);
      this.shake = 0.35;
      this.flash = 0.35;
      this.flashColor = '#ff5a5f';
      this.mood = -1;
    } else if (kind === 'run') {
      this.floaters.push({ x: W / 2, y: 300, text: `+${runs}`, life: 1.1, color: '#7CFC9A', size: 48 });
      this.burst(W / 2, 260, 22, palette, 170);
      this.cheer = 1;
      this.mood = 0.6;
    }
  }

  private burst(x: number, y: number, n: number, palette: string[], speed: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random() * 0.7);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - speed * 0.5,
        life: 1.1 + Math.random() * 0.7,
        max: 1.8,
        color: palette[i % palette.length],
        size: 3 + Math.random() * 4,
      });
    }
  }

  private next(): void {
    if (this.match.over) {
      this.finished = true;
      cancelAnimationFrame(this.frame);
      const m = this.match;
      const why = m.outs >= OUTS_TO_END ? 'All out' : `${MAX_BALLS / 6} overs`;
      this.done.emit({ score: m.runs, detail: `${m.runs} runs, ${m.outs} ${m.outs === 1 ? 'out' : 'outs'} · ${why}` });
      return;
    }
    this.view = 'bat';
    this.pad.set('bat');
    this.say('');
    this.enter('ready');
  }

  /** The fielding scene's clock: live while it plays, frozen once the ball is over. */
  private get ft(): number {
    return this.phase === 'field' ? this.t : this.fieldEnd;
  }

  // ---- drawing -------------------------------------------------------------------------------------------------------------------

  private draw(): void {
    const c = this.ctx;
    c.save();
    if (this.shake > 0) c.translate((Math.random() - 0.5) * this.shake * 22, (Math.random() - 0.5) * this.shake * 22);
    if (this.view === 'field') this.drawField();
    else this.drawBatting();
    this.drawMascot();
    c.restore();
    // A colour flash, confetti, and the floating numbers sit on top of everything.
    if (this.flash > 0) {
      c.globalAlpha = Math.min(0.4, this.flash * 0.5);
      c.fillStyle = this.flashColor;
      c.fillRect(0, 0, W, H);
      c.globalAlpha = 1;
    }
    for (const p of this.particles) {
      c.globalAlpha = Math.max(0, Math.min(1, p.life / 0.6));
      c.fillStyle = p.color;
      c.save();
      c.translate(p.x, p.y);
      c.rotate(p.life * 9);
      c.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      c.restore();
    }
    c.globalAlpha = 1;
    for (const f of this.floaters) {
      const age = 1 - Math.min(1, f.life / 1.2);
      const pop = age < 0.15 ? 0.4 + (age / 0.15) * 0.8 : 1.2 - Math.min(0.2, (age - 0.15) * 0.6);
      c.globalAlpha = Math.min(1, f.life * 2);
      c.font = `900 ${f.size * pop}px Geist, system-ui, sans-serif`;
      c.textAlign = 'center';
      c.lineWidth = 6;
      c.strokeStyle = 'rgba(0,0,0,0.55)';
      c.strokeText(f.text, f.x, f.y);
      c.fillStyle = f.color;
      c.fillText(f.text, f.x, f.y);
    }
    c.globalAlpha = 1;
  }

  /** The cricket (the insect) who keeps score in the corner: hops and cheers on boundaries, droops on an out. */
  private drawMascot(): void {
    const c = this.ctx;
    const hop = this.mood > 0.15 ? Math.abs(Math.sin(this.clock * 11)) * 14 * Math.min(1, this.mood) : 0;
    const x = 40;
    const y = 54 - hop;
    const sad = this.mood < -0.15;
    c.save();
    c.translate(x, y);
    this.ellipse(0, 22 + hop, 14, 3.5, 'rgba(0,0,0,0.25)');
    // Legs, body, head with antennae.
    c.strokeStyle = '#2f8a3e';
    c.lineWidth = 2.2;
    c.lineCap = 'round';
    for (const [dx, dy] of [[-9, 16], [9, 16], [-5, 18], [5, 18]]) {
      c.beginPath();
      c.moveTo(dx * 0.4, 6);
      c.lineTo(dx, dy + 4);
      c.stroke();
    }
    this.ellipse(0, 2, 12, 15, '#5fcf55');
    this.ellipse(-3, -2, 4, 9, 'rgba(255,255,255,0.22)');
    this.ellipse(0, -13, 9, 8, '#7be06e');
    c.strokeStyle = '#2f8a3e';
    c.lineWidth = 1.6;
    const wave = this.mood > 0.15 ? Math.sin(this.clock * 12) * 4 : 0;
    c.beginPath();
    c.moveTo(-4, -19);
    c.quadraticCurveTo(-12 - wave, -30, -16 - wave, -26);
    c.moveTo(4, -19);
    c.quadraticCurveTo(12 + wave, -30, 16 + wave, -26);
    c.stroke();
    this.ellipse(-3.2, -14, 2.4, 2.8, '#fff');
    this.ellipse(3.2, -14, 2.4, 2.8, '#fff');
    this.ellipse(-3.2 + (sad ? 0 : 0.4), -13.5 + (sad ? 1 : 0), 1.2, 1.4, '#15210f');
    this.ellipse(3.2 + (sad ? 0 : 0.4), -13.5 + (sad ? 1 : 0), 1.2, 1.4, '#15210f');
    c.strokeStyle = '#15210f';
    c.lineWidth = 1.2;
    c.beginPath();
    if (sad) c.arc(0, -7.5, 2.6, Math.PI * 1.1, Math.PI * 1.9);
    else c.arc(0, -10, 3, Math.PI * 0.15, Math.PI * 0.85);
    c.stroke();
    // A tiny bat, raised when happy.
    c.save();
    c.translate(11, 4);
    c.rotate(this.mood > 0.15 ? -0.9 - Math.sin(this.clock * 12) * 0.25 : 0.5);
    this.rect(-2, -14, 4, 22, '#d9b26f', 2);
    c.restore();
    c.restore();
  }

  private poly(points: [number, number][], fill: string | CanvasGradient): void {
    const c = this.ctx;
    c.beginPath();
    points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
    c.fillStyle = fill;
    c.fill();
  }

  private ellipse(x: number, y: number, rx: number, ry: number, fill: string | CanvasGradient): void {
    const c = this.ctx;
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    c.fillStyle = fill;
    c.fill();
  }

  private rect(x: number, y: number, w: number, h: number, fill: string, r = 0): void {
    const c = this.ctx;
    c.beginPath();
    if (r > 0 && c.roundRect) c.roundRect(x, y, w, h, r);
    else c.rect(x, y, w, h);
    c.fillStyle = fill;
    c.fill();
  }

  /** The view from behind the batter: stands, striped outfield, the pitch narrowing to the bowler, the ball coming down it. */
  private drawBatting(): void {
    const c = this.ctx;
    // Sky.
    const sky = c.createLinearGradient(0, 0, 0, 112);
    sky.addColorStop(0, '#3f8fdc');
    sky.addColorStop(1, '#bfe0f7');
    c.fillStyle = sky;
    c.fillRect(0, 0, W, 114);
    // Two tiers of stands with the crowd, and the floodlight towers.
    this.rect(0, 52, W, 62, '#3b3e57');
    this.rect(0, 52, W, 5, '#2a2c41');
    for (const d of CROWD) this.rect(d.x, d.y - (this.cheer > 0 ? Math.abs(Math.sin(this.clock * 13 + d.x)) * 5 * Math.min(1, this.cheer) : 0), 3, 3, d.c);
    c.fillStyle = 'rgba(0,0,0,0.18)';
    c.fillRect(0, 84, W, 2);
    for (const x of [26, W - 31]) {
      this.rect(x + 1, 8, 3, 56, '#23253a');
      this.rect(x - 8, 2, 21, 10, '#d8dde6', 2);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) this.ellipse(x - 3 + i * 7, 5 + j * 4, 2, 1.6, '#fffbe0');
    }
    // The sightscreen, behind the bowler's arm, and the advertising boards along the rope.
    this.rect(CX - 46, 66, 92, 46, '#f1f1ec', 2);
    const ads = ['#e5484d', '#1e6fd9', '#f5b82e', '#30a46c', '#8e4ec6', '#12a594'];
    for (let i = 0; i < 12; i++) this.rect(i * 30, 108, 30, 8, ads[i % ads.length]);
    // Outfield: mown stripes that widen towards us, with a little shading at the far edge.
    const grass = c.createLinearGradient(0, 116, 0, H);
    grass.addColorStop(0, '#2a7030');
    grass.addColorStop(1, '#3d9442');
    c.fillStyle = grass;
    c.fillRect(0, 116, W, H - 116);
    for (let i = 0; i < 8; i++) {
      const y0 = 116 + i * i * 5.2;
      const y1 = 116 + (i + 1) * (i + 1) * 5.2;
      if (i % 2 === 0) this.rect(0, y0, W, y1 - y0, 'rgba(255,255,255,0.05)');
    }
    // The pitch: a worn strip with a grass fringe either side.
    this.poly([[CX - HW_FAR - 5, FAR_Y - 8], [CX + HW_FAR + 5, FAR_Y - 8], [CX + HW_NEAR + 22, NEAR_Y], [CX - HW_NEAR - 22, NEAR_Y]], 'rgba(20,70,25,0.35)');
    const dirt = c.createLinearGradient(0, FAR_Y, 0, NEAR_Y);
    dirt.addColorStop(0, '#d9c495');
    dirt.addColorStop(0.6, '#cbb283');
    dirt.addColorStop(1, '#bda070');
    this.poly([[CX - HW_FAR, FAR_Y], [CX + HW_FAR, FAR_Y], [CX + HW_NEAR, NEAR_Y], [CX - HW_NEAR, NEAR_Y]], dirt);
    for (const w of WEAR) {
      const y = FAR_Y + 8 + w.p * (NEAR_Y - FAR_Y - 30);
      this.ellipse(CX + w.dx * hw(y) * 0.8, y, hw(y) * 0.5 * w.s, 3 + depth(y) * 6 * w.s, `rgba(110,80,40,${w.a})`);
    }
    // Creases: the bowling crease far away, the batting crease near, with the return creases.
    c.fillStyle = 'rgba(255,255,255,0.9)';
    const crease = (y: number) => {
      c.fillRect(CX - hw(y) * 0.92, y, hw(y) * 1.84, Math.max(1.2, depth(y) * 2.4));
      c.fillRect(CX - hw(y) * 0.92, y - depth(y) * 24, Math.max(1.2, depth(y) * 2), depth(y) * 24);
      c.fillRect(CX + hw(y) * 0.92 - depth(y) * 2, y - depth(y) * 24, Math.max(1.2, depth(y) * 2), depth(y) * 24);
    };
    crease(FAR_Y + 16);
    crease(HIT_Y + 14);
    this.drawTarget();
    // The bowler's stumps, the bowler, and the ball.
    this.stumps(CX, FAR_Y + 16, 0.26, 0);
    this.drawBowler();
    this.stumps(CX, NEAR_Y - 2, 0.95, this.stumpsHit ? Math.min(1, this.t / 0.5) : 0);
    this.drawBatter();
    if (this.phase === 'flight' || (this.phase === 'result' && !this.shot)) this.drawBall();
    if (this.phase === 'swing') this.drawHitBall();
  }

  /** Three stumps and two bails, `s` times the near-end size, standing on y. */
  private stumps(x: number, y: number, s: number, broken: number): void {
    const c = this.ctx;
    this.ellipse(x, y + 1, 16 * s, 3 * s, 'rgba(0,0,0,0.25)');
    [-9, 0, 9].forEach((dx, i) => {
      c.save();
      c.translate(x + dx * s, y);
      c.rotate(broken * [-0.9, 0.35, 1.1][i]);
      c.translate(broken * [-6, 0, 8][i] * s, -broken * 3);
      this.rect(-2.4 * s, -48 * s, 4.8 * s, 48 * s, '#e8d29a', 1);
      this.rect(-2.4 * s, -48 * s, 1.8 * s, 48 * s, 'rgba(255,255,255,0.45)', 1);
      c.restore();
    });
    // The bails pop off when the stumps are hit.
    const lift = broken > 0 ? Math.sin(broken * Math.PI) * 26 * s : 0;
    this.rect(x - 12 * s - broken * 14 * s, y - 51 * s - lift, 12 * s, 3 * s, '#f3e3b0');
    this.rect(x + broken * 18 * s, y - 51 * s - lift * 1.2, 12 * s, 3 * s, '#f3e3b0');
  }

  /** Where the ball will arrive: a ring where the bat meets it, and a wider ring closing in on it. Swing when they meet. */
  private drawTarget(): void {
    if (this.phase !== 'flight' || this.swung) return;
    const c = this.ctx;
    const p = this.flight;
    if (p < 0.2 || p > SWEET + 0.2) return;
    const x = CX;
    const y = HIT_Y + 2;
    const inside = Math.abs(p - SWEET) <= 0.08;
    const col = inside ? '#7CFC9A' : 'rgba(255,255,255,0.9)';
    const k = depth(HIT_Y);
    c.lineWidth = 3;
    c.strokeStyle = col;
    c.beginPath();
    c.ellipse(x, y, 24 * k, 8 * k, 0, 0, Math.PI * 2);
    c.stroke();
    const closing = Math.max(0, (SWEET - p) / SWEET);
    c.globalAlpha = Math.min(1, (p - 0.2) * 5);
    c.lineWidth = 2;
    c.strokeStyle = col;
    c.beginPath();
    c.ellipse(x, y, (24 + closing * 70) * k, (8 + closing * 24) * k, 0, 0, Math.PI * 2);
    c.stroke();
    c.globalAlpha = 1;
  }

  private drawBowler(): void {
    const c = this.ctx;
    const run = this.phase === 'ready' ? Math.min(1, this.t / 1.1) : 1;
    const s = 0.34 + 0.12 * run; // grows a touch as he runs in
    const y0 = FAR_Y - 20 + run * 22;
    const bob = this.phase === 'ready' ? Math.sin(this.clock * 16) * 1.4 * s : 0;
    const x = CX;
    this.ellipse(x, y0 + 56 * s, 16 * s, 4 * s, 'rgba(0,0,0,0.28)');
    // Legs in whites, striding.
    const stride = this.phase === 'ready' ? Math.sin(this.clock * 16) * 7 * s : 0;
    this.rect(x - 9 * s + stride, y0 + 28 * s, 8 * s, 28 * s, '#f4f4f4', 2);
    this.rect(x + 1 * s - stride, y0 + 28 * s, 8 * s, 28 * s, '#e8e8e8', 2);
    this.rect(x - 10 * s + stride, y0 + 53 * s, 10 * s, 4 * s, '#222');
    this.rect(x + 0 * s - stride, y0 + 53 * s, 10 * s, 4 * s, '#222');
    // Shirt, head, cap.
    this.rect(x - 11 * s, y0 + 6 * s + bob, 22 * s, 26 * s, '#1e6fd9', 4);
    this.ellipse(x, y0 - 2 * s + bob, 7 * s, 8 * s, '#c58c5d');
    this.rect(x - 8 * s, y0 - 10 * s + bob, 16 * s, 6 * s, '#12306b', 3);
    // The bowling arm: it goes right over as the ball is released.
    const release = this.phase === 'ready' ? Math.max(0, (run - 0.72) / 0.28) : 1;
    c.save();
    c.translate(x + 11 * s, y0 + 10 * s + bob);
    c.rotate(Math.PI * 0.95 - release * Math.PI * 1.9);
    this.rect(-2.2 * s, 0, 4.4 * s, 24 * s, '#c58c5d', 2);
    if (release < 0.5 && this.phase === 'ready') this.ellipse(0, 25 * s, 3.2 * s, 3.2 * s, '#c1121f');
    c.restore();
    this.rect(x - 11 * s - 2 * s, y0 + 8 * s + bob, 5 * s, 14 * s, '#1e6fd9', 2);
  }

  /** The ball: released from the bowler's hand, pitching on the track and coming up at the bat, with its shadow on the ground. */
  private drawBall(): void {
    const c = this.ctx;
    const p = Math.min(1.12, this.flight);
    const gy = groundY(p);
    const d = depth(gy);
    const lift = height(p) * d * 1.1;
    const x = CX;
    const y = gy - lift;
    const r = 2.6 + d * 7.5;
    this.ellipse(x, gy + 1, r * 1.1, r * 0.38, 'rgba(0,0,0,0.32)');
    // A streak behind it.
    const pp = Math.max(0, p - 0.06);
    const gy2 = groundY(pp);
    const x2 = CX;
    const y2 = gy2 - height(pp) * depth(gy2) * 1.1;
    const streak = c.createLinearGradient(x2, y2, x, y);
    streak.addColorStop(0, 'rgba(255,255,255,0)');
    streak.addColorStop(1, 'rgba(255,255,255,0.45)');
    c.strokeStyle = streak;
    c.lineWidth = r * 1.5;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(x2, y2);
    c.lineTo(x, y);
    c.stroke();
    this.cherry(x, y, r, this.clock * 14);
  }

  /** A red cricket ball with its seam and a highlight. */
  private cherry(x: number, y: number, r: number, spin: number): void {
    const c = this.ctx;
    const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, '#ff6b6b');
    g.addColorStop(0.55, '#c1121f');
    g.addColorStop(1, '#6b0710');
    this.ellipse(x, y, r, r, g);
    c.strokeStyle = 'rgba(255,246,220,0.85)';
    c.lineWidth = Math.max(0.7, r * 0.14);
    c.beginPath();
    c.ellipse(x, y, r * 0.78, r * 0.3, spin, 0, Math.PI * 2);
    c.stroke();
  }

  /** The ball leaving the bat after a hit, towards the side it was hit to, getting smaller as it goes. */
  private drawHitBall(): void {
    const shot = this.shot!;
    const u = Math.min(1, this.t / 0.4);
    const x0 = CX;
    const x = x0 + Math.sin(shot.angle) * 190 * u;
    const y = HIT_Y - 30 - (230 + (shot.outcome === 'six' ? 90 : 0)) * u + (shot.outcome === 'six' ? 0 : 60 * u * u);
    this.cherry(x, y, Math.max(2.4, 8 - 5.4 * u), this.clock * 20);
  }

  /** The batter from behind: helmet with a grille, shirt, gloves, pads and the bat. */
  private drawBatter(): void {
    const c = this.ctx;
    const x = CX;
    const y = NEAR_Y - 90;
    const swinging = this.swung && (this.phase === 'flight' || this.phase === 'swing');
    const elapsed = this.phase === 'flight' ? this.t - this.swingAt : 0.1 + this.t;
    const swing = this.swung ? Math.min(1, Math.max(0, elapsed) / 0.28) : 0;
    const side = (this.shot?.angle ?? 0) < 0 ? -1 : 1;
    this.ellipse(x, y + 66, 40, 9, 'rgba(0,0,0,0.3)');
    // Boots, pads (with straps) and thigh guards.
    this.rect(x - 20, y + 58, 17, 8, '#1d1d1d', 3);
    this.rect(x + 3, y + 58, 17, 8, '#1d1d1d', 3);
    this.rect(x - 18, y + 8, 14, 52, '#f6f6f2', 5);
    this.rect(x + 4, y + 8, 14, 52, '#f6f6f2', 5);
    for (const dy of [22, 36, 48]) {
      this.rect(x - 18, y + dy, 14, 2.5, '#cfcfc8');
      this.rect(x + 4, y + dy, 14, 2.5, '#cfcfc8');
    }
    this.rect(x - 18, y + 6, 14, 6, '#e9e9e2', 3);
    this.rect(x + 4, y + 6, 14, 6, '#e9e9e2', 3);
    // Shirt with shoulders, a stripe and the number.
    const shirt = c.createLinearGradient(x - 24, 0, x + 24, 0);
    shirt.addColorStop(0, '#2a7be8');
    shirt.addColorStop(0.5, '#1e6fd9');
    shirt.addColorStop(1, '#1757ad');
    this.poly([[x - 24, y - 34], [x + 24, y - 34], [x + 19, y + 12], [x - 19, y + 12]], shirt);
    this.rect(x - 24, y - 34, 48, 6, '#f5b82e');
    c.fillStyle = '#fff';
    c.font = '800 16px Geist, system-ui, sans-serif';
    c.textAlign = 'center';
    c.fillText('7', x, y - 6);
    // Helmet with a grille.
    this.ellipse(x, y - 46, 12.5, 13, '#12306b');
    this.ellipse(x - 3, y - 51, 5, 3.5, 'rgba(255,255,255,0.28)');
    this.rect(x - 7, y - 38, 14, 6, '#c58c5d', 2);
    c.strokeStyle = 'rgba(255,255,255,0.35)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(x - 12, y - 42);
    c.lineTo(x + 12, y - 42);
    c.stroke();
    // The bat: held low behind the pads, then swung through towards the side the ball goes to.
    c.save();
    c.translate(x + 15, y - 10);
    c.rotate(swinging ? -0.85 + side * swing * 2.5 : swing > 0 ? side * 1.65 : -0.85);
    const blade = c.createLinearGradient(-4, 0, 4, 0);
    blade.addColorStop(0, '#e6c98d');
    blade.addColorStop(1, '#c9a366');
    this.rect(-4, 4, 8, 48, '#d9b26f', 2);
    c.fillStyle = blade;
    c.fillRect(-4, 4, 8, 48);
    this.rect(-2, -16, 4, 21, '#2d2d2d', 2);
    this.rect(-5, -17, 10, 9, '#f5b82e', 3); // gloves on the handle
    c.restore();
  }

  // ---- fielding mode ---------------------------------------------------------------------------------------------------------------

  /** The whole ground from above, with the ball, the fielders and the batters running. */
  private drawField(): void {
    const c = this.ctx;
    const plan = this.plan!;
    const shot = this.shot!;
    const cx = W / 2;
    const cy = 240;
    const k = 1.78; // field units to screen pixels
    const sx = (p: Pt) => cx + p.x * k;
    const sy = (p: Pt) => cy + p.y * k;
    // The stands all round, with the crowd in the seats.
    this.rect(0, 0, W, H, '#3b3e57');
    for (let i = 0; i < 300; i++) {
      const a = (i * 2.399963) % (Math.PI * 2);
      const rr = (ROPE + 12 + ((i * 37) % 60) * 0.5) * k;
      const px = cx + Math.cos(a) * rr;
      const py = cy + Math.sin(a) * rr;
      if (px > 2 && px < W - 2 && py > 2 && py < H - 2) this.rect(px, py - (this.cheer > 0 ? Math.abs(Math.sin(this.clock * 13 + i)) * 5 * Math.min(1, this.cheer) : 0), 3, 3, CROWD[i % CROWD.length].c);
    }
    // The ground: mown stripes inside the rope.
    c.save();
    c.beginPath();
    c.arc(cx, cy, (ROPE + 8) * k, 0, Math.PI * 2);
    c.clip();
    this.rect(0, 0, W, H, '#2f7d34');
    for (let i = -8; i < 9; i++) if (i % 2 === 0) this.rect(cx + i * 20 * 1.0 - 10, 0, 20, H, '#3a8f3f');
    c.restore();
    c.strokeStyle = '#fff';
    c.lineWidth = 3;
    c.beginPath();
    c.arc(cx, cy, ROPE * k, 0, Math.PI * 2);
    c.stroke();
    c.setLineDash([5, 6]);
    c.lineWidth = 1.5;
    c.strokeStyle = 'rgba(255,255,255,0.55)';
    c.beginPath();
    c.arc(cx, cy, 58 * k, 0, Math.PI * 2);
    c.stroke();
    c.setLineDash([]);
    // The pitch with its creases and stumps.
    this.rect(cx - 5 * k, sy(BOWL_END) - 4 * k, 10 * k, (BAT_END.y - BOWL_END.y + 8) * k, '#cbb283', 2);
    c.fillStyle = 'rgba(255,255,255,0.8)';
    c.fillRect(cx - 6 * k, sy(BOWL_END) + 1 * k, 12 * k, 1.5);
    c.fillRect(cx - 6 * k, sy(BAT_END) - 1 * k, 12 * k, 1.5);
    for (const e of [BOWL_END, BAT_END]) for (const dx of [-3, 0, 3]) this.rect(cx + dx - 1, sy(e) - 2, 2, 4, '#f4e7c5');

    // The fielders (in gold) and the batters (in blue).
    FIELDERS.forEach((_, i) => {
      const p = fielderPoint(plan, i, this.ft);
      const chaser = i === plan.fielder && plan.kind !== 'boundary';
      this.person(sx(p), sy(p), chaser ? '#ffcf33' : '#e8a317', 7.5, chaser);
    });
    this.drawRunnersField(sx, sy);

    // The ball.
    const t = this.ft;
    let b: Pt = { ...BAT_END };
    let air = 0;
    if (plan.kind === 'boundary' || plan.kind === 'caught') {
      const p = Math.min(1, t / plan.ballTime);
      b = { x: BAT_END.x + (plan.end.x - BAT_END.x) * p, y: BAT_END.y + (plan.end.y - BAT_END.y) * p };
      air = Math.sin(p * Math.PI) * (shot.outcome === 'six' ? 26 : plan.kind === 'caught' ? 22 : 4);
      if (plan.kind === 'caught' && t > plan.ballTime) air = 8; // held in the fielder's hands
    } else if (t <= plan.tMeet) {
      b = rollPoint(plan, t);
    } else {
      // Thrown back to the bowler's end.
      const meet = rollPoint(plan, plan.tMeet);
      const p = Math.min(1, (t - plan.tMeet) / Math.max(0.01, plan.returned - plan.tMeet));
      b = { x: meet.x + (BOWL_END.x - meet.x) * p, y: meet.y + (BOWL_END.y - meet.y) * p };
      air = Math.sin(p * Math.PI) * 6;
    }
    if (plan.kind === 'play' && t < plan.tMeet) {
      c.strokeStyle = 'rgba(255,255,255,0.32)';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(sx(BAT_END), sy(BAT_END));
      c.lineTo(sx(b), sy(b));
      c.stroke();
    }
    this.ellipse(sx(b), sy(b) + 2, 4.5, 2, 'rgba(0,0,0,0.38)');
    this.cherry(sx(b), sy(b) - air, 4.6, this.clock * 12);
    if (plan.kind === 'caught' && t >= plan.ballTime) {
      c.strokeStyle = 'rgba(255,255,255,0.85)';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(sx(plan.end), sy(plan.end), 14 + Math.sin(this.clock * 12) * 2, 0, Math.PI * 2);
      c.stroke();
    }
  }

  private drawRunnersField(sx: (p: Pt) => number, sy: (p: Pt) => number): void {
    const r = this.running;
    const swapped = (r?.runs ?? 0) % 2 === 1;
    const from = swapped ? BOWL_END : BAT_END;
    const to = swapped ? BAT_END : BOWL_END;
    if (r && r.start !== null) {
      const p = Math.max(0, Math.min(1, (this.ft - r.start) / RUN_SECONDS));
      const at = (s: Pt, e: Pt) => ({ x: s.x + (e.x - s.x) * p, y: s.y + (e.y - s.y) * p });
      const m = at(from, to);
      const o = at(to, from);
      this.person(sx(m) - 6, sy(m), '#1e6fd9', 7, false);
      this.person(sx(o) + 6, sy(o), '#6fa0f0', 7, false);
    } else {
      this.person(sx(from) - 6, sy(from), '#1e6fd9', 7, false);
      this.person(sx(to) + 6, sy(to), '#6fa0f0', 7, false);
    }
  }

  /** A fielder or batter seen from above: a shadow, shoulders, a head, and a ring on the one who is chasing the ball. */
  private person(x: number, y: number, shirt: string, r: number, ring: boolean): void {
    const c = this.ctx;
    this.ellipse(x + 1.5, y + 3, r * 0.95, r * 0.5, 'rgba(0,0,0,0.3)');
    this.ellipse(x, y, r, r * 0.8, shirt);
    this.ellipse(x, y - r * 0.15, r * 0.52, r * 0.52, '#c58c5d');
    this.ellipse(x, y - r * 0.28, r * 0.5, r * 0.32, 'rgba(18,48,107,0.9)');
    if (ring) {
      c.strokeStyle = 'rgba(255,255,255,0.8)';
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(x, y, r + 4, 0, Math.PI * 2);
      c.stroke();
    }
  }
}
