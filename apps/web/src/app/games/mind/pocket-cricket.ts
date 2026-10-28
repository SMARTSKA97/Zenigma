import { ChangeDetectionStrategy, Component, ElementRef, HostListener, OnDestroy, OnInit, inject, output, signal, viewChild } from '@angular/core';
import { HapticsService } from '../../core/haptics.service';
import { PlayScreen } from '../../shared/play-screen';
import { MindResult } from './mind-util';
import {
  BAT_END,
  BOWL_END,
  clampLane,
  deliver,
  Delivery,
  FIELDERS,
  FieldPlan,
  fielderPoint,
  Match,
  MAX_BALLS,
  MAX_LANE,
  OUTS_TO_END,
  planField,
  playShot,
  Pt,
  rollPoint,
  ROPE,
  Running,
  RUN_SECONDS,
  Shot,
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
/** The ball's height on the screen at progress p: the ball is pitched at 0.6 and bounces up and on. */
const ballY = (p: number): number => FAR_Y + 18 + p * (NEAR_Y - 130 - FAR_Y);
const bounce = (p: number): number => (p < 0.6 ? Math.sin((p / 0.6) * Math.PI) * 0.0 + (1 - p / 0.6) * 38 : Math.sin(((p - 0.6) / 0.4) * Math.PI) * 26);

/**
 * A pocket cricket game: the batter's view from behind, then the field from above. Shift the batter left or right along the crease so the bat
 * is in the ball's lane, and press Shot as the ball arrives. Miss and you are out. Hit it and the view cuts to the field: press Run to go
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
  protected readonly call = signal('Get ready');
  protected readonly view = signal<'bat' | 'field'>('bat');
  protected readonly canShoot = signal(false);
  protected readonly canRun = signal(false);
  protected readonly outList = Array.from({ length: OUTS_TO_END }, (_, i) => i);

  private readonly match = new Match();
  private phase: Phase = 'ready';
  private t = 0;
  private flight = 0;
  private delivery: Delivery = { lane: 0, seconds: 1.2 };
  private lane = 0;
  private batX = 0; // the batter's lane while it slides, 0 = centre
  private swung = false;
  private swingAt = 0;
  private shot: Shot | null = null;
  private plan: FieldPlan | null = null;
  private running: Running | null = null;
  private resultFor = 0.9;
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
    if (event.key === 'ArrowLeft') this.shift(-1);
    else if (event.key === 'ArrowRight') this.shift(1);
    else if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (this.phase === 'field') this.run();
      else this.hit();
    } else if (event.key === 'ArrowUp') this.run();
  }

  /** Move the batter one lane along the crease. */
  protected shift(by: -1 | 1): void {
    if (this.phase !== 'ready' && this.phase !== 'flight') return;
    if (this.swung) return;
    const next = clampLane(this.lane + by);
    if (next !== this.lane) this.haptics.tick();
    this.lane = next;
  }

  /** Swing the bat. */
  protected hit(): void {
    if (this.phase !== 'flight' || this.swung) return;
    this.swung = true;
    this.swingAt = this.t;
    this.canShoot.set(false);
    this.haptics.tap();
    const shot = playShot(this.flight, this.lane, this.delivery.lane, Math.random);
    this.shot = shot;
    if (shot.outcome === 'miss') {
      this.call.set(Math.abs(this.lane - this.delivery.lane) > 1 ? 'Wrong lane!' : this.flight < 0.7 ? 'Too early!' : 'Too late!');
      return;
    }
    this.plan = planField(shot);
    this.enter('swing');
    this.call.set(shot.outcome === 'six' ? 'Smashed!' : 'Hit!');
    this.haptics.place();
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
    // The batter slides to the chosen lane.
    this.batX += (this.lane - this.batX) * Math.min(1, dt * 14);
    switch (this.phase) {
      case 'ready':
        if (this.t >= 1.1) {
          this.delivery = deliver(Math.random);
          this.flight = 0;
          this.swung = false;
          this.shot = null;
          this.plan = null;
          this.running = null;
          this.call.set('');
          this.enter('flight');
        }
        break;
      case 'flight':
        this.flight += dt / this.delivery.seconds;
        if (this.flight >= 1.05) {
          this.haptics.error();
          this.finishBall(0, true, 'Bowled!', 1);
        }
        break;
      case 'swing':
        if (this.t >= 0.35) this.startField();
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
    this.view.set('field');
    this.enter('field');
    if (plan.kind === 'play') {
      this.running = new Running(plan.returned);
      this.canRun.set(true);
      this.call.set('Run!');
    } else if (plan.kind === 'boundary') {
      this.call.set(shot.outcome === 'six' ? 'SIX!' : 'FOUR!');
      shot.outcome === 'six' ? this.haptics.success() : this.haptics.place();
    } else {
      this.call.set('In the air...');
    }
  }

  private updateField(): void {
    const plan = this.plan!;
    const shot = this.shot!;
    if (plan.kind === 'boundary') {
      if (this.t >= 1.1) this.finishBall(shot.outcome === 'six' ? 6 : 4, false, shot.outcome === 'six' ? 'SIX!' : 'FOUR!', 0.7);
    } else if (plan.kind === 'caught') {
      if (this.t >= plan.returned) {
        this.haptics.error();
        this.finishBall(0, true, 'Caught!', 1);
      }
    } else if (this.running) {
      this.running.tick(this.t);
      if (this.running.done) {
        const r = this.running;
        if (r.out) {
          this.haptics.error();
          this.finishBall(r.runs, true, 'Run out!', 1);
        } else {
          this.finishBall(r.runs, false, r.runs === 0 ? 'No run' : r.runs === 1 ? '1 run' : `${r.runs} runs`, 0.8);
        }
      }
    }
  }

  private finishBall(runs: number, out: boolean, text: string, hold: number): void {
    this.match.record(runs, out);
    this.runs.set(this.match.runs);
    this.balls.set(this.match.overs);
    this.outs.set(this.match.outs);
    this.call.set(out ? `OUT! ${text}` : text);
    this.resultFor = hold;
    this.enter('result');
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
    this.view.set('bat');
    this.call.set('');
    this.enter('ready');
  }

  // ---- drawing -------------------------------------------------------------------------------------------------------------------

  private draw(): void {
    if (this.view() === 'field') this.drawField();
    else this.drawBatting();
  }

  private poly(points: [number, number][], fill: string): void {
    const c = this.ctx;
    c.beginPath();
    points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
    c.fillStyle = fill;
    c.fill();
  }

  private ellipse(x: number, y: number, rx: number, ry: number, fill: string): void {
    const c = this.ctx;
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    c.fillStyle = fill;
    c.fill();
  }

  /** The view from behind the batter: stands, striped outfield, the pitch narrowing to the bowler, the ball coming down it. */
  private drawBatting(): void {
    const c = this.ctx;
    // Sky and stands.
    const sky = c.createLinearGradient(0, 0, 0, 110);
    sky.addColorStop(0, '#5aa9e6');
    sky.addColorStop(1, '#cfe9fb');
    c.fillStyle = sky;
    c.fillRect(0, 0, W, 112);
    c.fillStyle = '#4b4f6b';
    c.fillRect(0, 62, W, 52);
    for (let i = 0; i < 160; i++) {
      c.fillStyle = ['#e5484d', '#f5b82e', '#ffffff', '#3e63dd', '#30a46c'][i % 5];
      c.fillRect((i * 37) % W, 66 + ((i * 17) % 44), 3, 3);
    }
    // Floodlight posts.
    c.fillStyle = '#2a2d40';
    c.fillRect(30, 20, 5, 60);
    c.fillRect(W - 35, 20, 5, 60);
    // Outfield, in stripes that widen towards us.
    c.fillStyle = '#2e7d32';
    c.fillRect(0, 112, W, H - 112);
    for (let i = 0; i < 9; i++) {
      const y0 = 112 + i * i * 4.6;
      const y1 = 112 + (i + 1) * (i + 1) * 4.6;
      if (i % 2 === 0) {
        c.fillStyle = '#3a8f3f';
        c.fillRect(0, y0, W, y1 - y0);
      }
    }
    // The boundary rope across the far end.
    c.fillStyle = '#f5f5f5';
    c.fillRect(0, 112, W, 3);
    // The pitch.
    this.poly([[CX - HW_FAR, FAR_Y], [CX + HW_FAR, FAR_Y], [CX + HW_NEAR, NEAR_Y], [CX - HW_NEAR, NEAR_Y]], '#cdb58a');
    const crease = (y: number) => {
      c.fillStyle = 'rgba(255,255,255,0.85)';
      c.fillRect(CX - hw(y), y, hw(y) * 2, 2);
    };
    crease(FAR_Y + 14);
    crease(NEAR_Y - 82);
    // Lane marks (faint), so the batter's lanes can be seen.
    c.strokeStyle = 'rgba(120,90,40,0.18)';
    c.lineWidth = 1;
    for (let l = -MAX_LANE + 0.5; l <= MAX_LANE - 0.5; l += 1) {
      c.beginPath();
      c.moveTo(CX + l * HW_FAR * 0.4, FAR_Y);
      c.lineTo(CX + l * HW_NEAR * 0.4, NEAR_Y);
      c.stroke();
    }
    // The stumps at the far end, and the bowler.
    for (const dx of [-5, 0, 5]) {
      c.fillStyle = '#f4e7c5';
      c.fillRect(CX + dx - 1, FAR_Y + 4, 2, 15);
    }
    this.drawBowler();
    // The ball.
    if (this.phase === 'flight' || (this.phase === 'result' && !this.shot)) this.drawBall();
    // The stumps behind the batter, then the batter.
    for (const dx of [-14, 0, 14]) {
      c.fillStyle = '#f4e7c5';
      c.fillRect(CX + dx - 2.5, NEAR_Y - 70, 5, 52);
    }
    this.drawBatter();
    // A lane marker under the ball's next lane isn't shown: finding the lane is the game.
  }

  private laneX(lane: number, y: number): number {
    return CX + lane * hw(y) * 0.4;
  }

  private drawBowler(): void {
    const c = this.ctx;
    const run = this.phase === 'ready' ? Math.min(1, this.t / 1.1) : 1;
    const y = FAR_Y - 36 + run * 24 + Math.sin(this.clock * 14) * (this.phase === 'ready' ? 1.2 : 0);
    const x = CX;
    this.ellipse(x, y + 34, 9, 3, 'rgba(0,0,0,0.25)');
    c.fillStyle = '#f2f2f2'; // trousers
    c.fillRect(x - 5, y + 16, 4, 18);
    c.fillRect(x + 1, y + 16, 4, 18);
    c.fillStyle = '#1e6fd9'; // shirt
    c.fillRect(x - 6, y, 12, 18);
    this.ellipse(x, y - 5, 5, 5.5, '#c98d62');
    c.fillStyle = '#1e6fd9';
    c.fillRect(x - 5, y - 10, 10, 4);
    // The bowling arm swings over as the ball is released.
    const arm = this.phase === 'ready' ? (run > 0.7 ? -Math.PI * 1.5 * ((run - 0.7) / 0.3) : 0) : -Math.PI * 1.5;
    c.save();
    c.translate(x + 6, y + 3);
    c.rotate(arm + Math.PI * 0.9);
    c.fillStyle = '#c98d62';
    c.fillRect(-1.5, 0, 3, 13);
    c.restore();
  }

  private drawBall(): void {
    const c = this.ctx;
    const p = Math.min(1.05, this.flight);
    const y = ballY(p);
    const lift = bounce(p) * (0.35 + p);
    const x = this.laneX(this.delivery.lane, y);
    const r = 2.5 + p * 8;
    this.ellipse(x, y + 4, r * 1.1, r * 0.4, 'rgba(0,0,0,0.3)');
    // A short streak behind it.
    c.strokeStyle = 'rgba(255,255,255,0.35)';
    c.lineWidth = r * 0.8;
    c.beginPath();
    c.moveTo(this.laneX(this.delivery.lane, y - 20), y - lift - 20 * 0.8);
    c.lineTo(x, y - lift);
    c.stroke();
    this.ellipse(x, y - lift, r, r, '#c1121f');
    c.strokeStyle = 'rgba(255,255,255,0.8)';
    c.lineWidth = 1;
    c.beginPath();
    c.arc(x, y - lift, r * 0.7, 0.4, 2.2);
    c.stroke();
  }

  /** The batter from behind: helmet, shirt, pads and the bat. */
  private drawBatter(): void {
    const c = this.ctx;
    const x = this.laneX(this.batX, NEAR_Y - 44);
    const y = NEAR_Y - 44;
    const swing = this.swung ? Math.min(1, (this.phase === 'flight' ? this.t - this.swingAt : this.phase === 'swing' ? 0.2 + this.t : 0.6) / 0.28) : 0;
    this.ellipse(x, y + 62, 36, 8, 'rgba(0,0,0,0.3)');
    // Pads and boots.
    c.fillStyle = '#f5f5f5';
    c.fillRect(x - 17, y + 6, 13, 52);
    c.fillRect(x + 4, y + 6, 13, 52);
    c.fillStyle = '#d9d9d9';
    c.fillRect(x - 17, y + 24, 13, 3);
    c.fillRect(x + 4, y + 24, 13, 3);
    c.fillStyle = '#222';
    c.fillRect(x - 18, y + 56, 15, 6);
    c.fillRect(x + 3, y + 56, 15, 6);
    // Shirt, with a number across the back.
    c.fillStyle = '#1e6fd9';
    this.poly([[x - 21, y - 36], [x + 21, y - 36], [x + 17, y + 10], [x - 17, y + 10]], '#1e6fd9');
    c.fillStyle = '#fff';
    c.font = '700 14px Geist, system-ui, sans-serif';
    c.textAlign = 'center';
    c.fillText('7', x, y - 12);
    // Helmet and neck.
    this.ellipse(x, y - 46, 11, 12, '#12306b');
    c.fillStyle = '#c98d62';
    c.fillRect(x - 5, y - 38, 10, 5);
    // The bat: held low and back, swinging through in an arc.
    c.save();
    c.translate(x + 14, y - 8);
    c.rotate(-0.9 + swing * (this.shotSide() * 2.4));
    c.fillStyle = '#d9b26f';
    c.fillRect(-3, -4, 6, 46);
    c.fillStyle = '#8a5a2b';
    c.fillRect(-1.5, -20, 3, 17);
    c.restore();
  }

  /** Which way the bat swings, from where the ball is going (right-hand batter: through the on side for lefts). */
  private shotSide(): number {
    const a = this.shot?.angle ?? 0;
    return a < 0 ? -1 : 1;
  }

  /** Fielding mode: the whole ground from above, with the ball, the fielders and the batters running. */
  private drawField(): void {
    const c = this.ctx;
    const plan = this.plan!;
    const shot = this.shot!;
    const cx = W / 2;
    const cy = 238;
    const k = 1.78; // field units to screen pixels
    const sx = (p: Pt) => cx + p.x * k;
    const sy = (p: Pt) => cy + p.y * k;
    // Outside the rope: the stands.
    c.fillStyle = '#4b4f6b';
    c.fillRect(0, 0, W, H);
    // The ground, in mown rings.
    for (let i = 0; i < 6; i++) {
      this.ellipse(cx, cy, (ROPE + 6 - i * 16) * k, (ROPE + 6 - i * 16) * k, i % 2 ? '#3a8f3f' : '#2e7d32');
    }
    c.strokeStyle = '#fff';
    c.lineWidth = 3;
    c.beginPath();
    c.arc(cx, cy, ROPE * k, 0, Math.PI * 2);
    c.stroke();
    c.setLineDash([5, 6]);
    c.lineWidth = 1.5;
    c.strokeStyle = 'rgba(255,255,255,0.5)';
    c.beginPath();
    c.arc(cx, cy, 58 * k, 0, Math.PI * 2);
    c.stroke();
    c.setLineDash([]);
    // The pitch and its stumps.
    c.fillStyle = '#cdb58a';
    c.fillRect(cx - 5 * k, sy(BOWL_END) - 4 * k, 10 * k, (BAT_END.y - BOWL_END.y + 8) * k);
    for (const e of [BOWL_END, BAT_END]) {
      c.fillStyle = '#f4e7c5';
      c.fillRect(cx - 3, sy(e) - 3, 6, 6);
    }

    // The fielders.
    FIELDERS.forEach((_, i) => {
      const p = fielderPoint(plan, i, this.t);
      this.person(sx(p), sy(p), i === plan.fielder && plan.kind !== 'boundary' ? '#ffd23f' : '#e5484d', 7);
    });

    // The batters.
    this.drawRunnersField(sx, sy);

    // The ball.
    const t = this.t;
    let b: Pt = { ...BAT_END };
    let air = 0;
    if (plan.kind === 'boundary') {
      const p = Math.min(1, t / plan.ballTime);
      b = { x: BAT_END.x + (plan.end.x - BAT_END.x) * p, y: BAT_END.y + (plan.end.y - BAT_END.y) * p };
      air = shot.outcome === 'six' ? Math.sin(p * Math.PI) * 22 : 0;
    } else if (plan.kind === 'caught') {
      const p = Math.min(1, t / plan.ballTime);
      b = { x: BAT_END.x + (plan.end.x - BAT_END.x) * p, y: BAT_END.y + (plan.end.y - BAT_END.y) * p };
      air = Math.sin(p * Math.PI) * 26;
    } else if (t <= plan.tMeet) {
      b = rollPoint(plan, t);
    } else {
      // Thrown back to the bowler's end.
      const meet = rollPoint(plan, plan.tMeet);
      const p = Math.min(1, (t - plan.tMeet) / Math.max(0.01, plan.returned - plan.tMeet));
      b = { x: meet.x + (BOWL_END.x - meet.x) * p, y: meet.y + (BOWL_END.y - meet.y) * p };
    }
    this.ellipse(sx(b), sy(b) + 2, 4, 2, 'rgba(0,0,0,0.35)');
    this.ellipse(sx(b), sy(b) - air, 4.5, 4.5, '#c1121f');
    c.strokeStyle = 'rgba(255,255,255,0.6)';
    c.lineWidth = 1;
    c.beginPath();
    c.arc(sx(b), sy(b) - air, 3, 0.4, 2.2);
    c.stroke();
    if (plan.kind === 'play' && t < plan.tMeet) {
      // A faint track behind the rolling ball.
      c.strokeStyle = 'rgba(255,255,255,0.3)';
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(sx(BAT_END), sy(BAT_END));
      c.lineTo(sx(b), sy(b));
      c.stroke();
    }
  }

  private drawRunnersField(sx: (p: Pt) => number, sy: (p: Pt) => number): void {
    const r = this.running;
    const a = { ...BAT_END };
    const b = { ...BOWL_END };
    const swapped = (r?.runs ?? 0) % 2 === 1;
    const from = swapped ? b : a;
    const to = swapped ? a : b;
    if (r && r.start !== null) {
      const p = Math.max(0, Math.min(1, (this.t - r.start) / RUN_SECONDS));
      const at = (s: Pt, e: Pt) => ({ x: s.x + (e.x - s.x) * p + 0, y: s.y + (e.y - s.y) * p });
      const m = at(from, to);
      const o = at(to, from);
      this.person(sx(m) - 5, sy(m), '#1e6fd9', 7);
      this.person(sx(o) + 5, sy(o), '#7aa7f0', 7);
    } else {
      this.person(sx(from) - 5, sy(from), '#1e6fd9', 7);
      this.person(sx(to) + 5, sy(to), '#7aa7f0', 7);
    }
  }

  /** A fielder or batter seen from above: a shadow, a body and a head. */
  private person(x: number, y: number, shirt: string, r: number): void {
    this.ellipse(x, y + 2.5, r * 0.9, r * 0.45, 'rgba(0,0,0,0.3)');
    this.ellipse(x, y, r, r * 0.85, shirt);
    this.ellipse(x, y - r * 0.15, r * 0.5, r * 0.5, '#c98d62');
  }
}
