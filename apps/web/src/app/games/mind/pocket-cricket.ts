import { ChangeDetectionStrategy, Component, ElementRef, HostListener, OnDestroy, OnInit, computed, inject, output, signal, viewChild } from '@angular/core';
import { HapticsService } from '../../core/haptics.service';
import { PlayScreen } from '../../shared/play-screen';
import { BALLS_PER_INNINGS, BOUNDARY, deliver, Delivery, fieldTimes, Match, playShot, Running, RUN_SECONDS, Shot, Side, WICKETS } from './pocket-cricket-engine';
import { MindResult } from './mind-util';

/** The screen is drawn on a small grid and scaled up, like an old phone's display. */
const LW = 120;
const LH = 160;
const BG = '#cfe0a8';
const MID = '#8fae5a';
const INK = '#223314';
/** Where things are, on that grid. */
const PITCH_X = 60;
const BOWLER_Y = 24;
const BAT_Y = 120;

type Phase = 'ready' | 'flight' | 'play' | 'result' | 'over';

/**
 * A pocket cricket game in the style of the old phone one. Two overs, two wickets. The ball comes down the pitch at a random speed and on
 * a random side: tap Left shot or Right shot as it reaches the bat (the right side and the right moment make fours and sixes). After a
 * hit that stays in the field, tap Run to go for runs before the fielder throws the ball back: a run out costs a wicket.
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
  protected readonly overs = signal('0.0');
  protected readonly wickets = signal(0);
  protected readonly call = signal('Get ready');
  protected readonly phaseSig = signal<Phase>('ready');
  protected readonly canShoot = computed(() => this.phaseSig() === 'flight');
  /** Run is live only after a hit that stays in the field (a four or a six needs no running). */
  protected readonly canRun = signal(false);
  protected readonly wicketList = Array.from({ length: WICKETS }, (_, i) => i);

  private readonly match = new Match();
  private phase: Phase = 'ready';
  private t = 0; // seconds in the phase
  private flight = 0; // 0..1 progress of the ball
  private delivery: Delivery = { line: 0, seconds: 1.2 };
  private swung: Side | null = null;
  private swingAt = -1;
  private shot: Shot | null = null;
  private running: Running | null = null;
  private lastRuns = 0;
  private lastWicket = false;
  private frame = 0;
  private last = 0;
  private finished = false;
  private ctx!: CanvasRenderingContext2D;

  ngOnInit(): void {
    const canvas = this.canvasRef().nativeElement;
    canvas.width = LW;
    canvas.height = LH;
    this.ctx = canvas.getContext('2d')!;
    this.last = performance.now();
    this.frame = requestAnimationFrame((n) => this.loop(n));
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.frame);
  }

  @HostListener('document:keydown', ['$event'])
  protected key(event: KeyboardEvent): void {
    if (event.repeat) return;
    if (event.key === 'ArrowLeft') this.swing('left');
    else if (event.key === 'ArrowRight') this.swing('right');
    else if (event.key === ' ' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.run();
    }
  }

  protected swing(side: Side): void {
    if (this.phase !== 'flight' || this.swung) return;
    this.swung = side;
    this.swingAt = this.t;
    this.haptics.tap();
    const shot = playShot(this.flight, side, this.delivery.line, Math.random);
    this.shot = shot;
    if (shot.outcome === 'miss') {
      this.call.set(this.flight < 0.7 ? 'Too early!' : 'Too late!');
    } else if (shot.outcome === 'caught') {
      this.haptics.error();
      this.finishBall(0, true, 'Caught!', 0.6);
    } else if (shot.outcome === 'four' || shot.outcome === 'six') {
      const six = shot.outcome === 'six';
      six ? this.haptics.success() : this.haptics.place();
      this.enter('play');
      this.call.set(six ? 'SIX!' : 'FOUR!');
    } else {
      this.haptics.place();
      this.enter('play');
      this.running = new Running(fieldTimes(shot.dist).returned);
      this.canRun.set(true);
      this.call.set('Run!');
    }
  }

  protected run(): void {
    if (this.phase !== 'play' || !this.running) return;
    this.haptics.tick();
    this.running.tap(this.t);
  }

  private enter(phase: Phase): void {
    this.phase = phase;
    this.phaseSig.set(phase);
    this.canRun.set(false);
    this.t = 0;
  }

  private loop(now: number): void {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.update(dt);
    this.draw();
    if (!this.finished) this.frame = requestAnimationFrame((n) => this.loop(n));
  }

  private update(dt: number): void {
    this.t += dt;
    switch (this.phase) {
      case 'ready':
        if (this.t >= 0.9) {
          this.delivery = deliver(Math.random);
          this.flight = 0;
          this.swung = null;
          this.shot = null;
          this.running = null;
          this.call.set('');
          this.enter('flight');
        }
        break;
      case 'flight':
        this.flight += dt / this.delivery.seconds;
        if (this.flight >= 1.04) {
          if (this.swung) this.finishBall(0, false, 'Missed! Dot ball', 0.9);
          else this.finishBall(0, true, 'Bowled!', 0.9);
        }
        break;
      case 'play': {
        const shot = this.shot!;
        if (shot.outcome === 'four' || shot.outcome === 'six') {
          if (this.t >= 0.9) this.finishBall(shot.outcome === 'six' ? 6 : 4, false, shot.outcome === 'six' ? 'SIX!' : 'FOUR!', 0.8);
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
        break;
      }
      case 'result':
        if (this.t >= this.resultFor) this.next();
        break;
      default:
        break;
    }
  }

  private resultFor = 0.9;

  private finishBall(runs: number, wicket: boolean, text: string, hold: number): void {
    this.lastRuns = runs;
    this.lastWicket = wicket;
    this.match.record(runs, wicket);
    this.runs.set(this.match.runs);
    this.overs.set(this.match.overs);
    this.wickets.set(this.match.wickets);
    this.call.set(wicket && !text.includes('!') ? `${text}!` : text);
    this.resultFor = hold;
    this.enter('result');
  }

  private next(): void {
    if (this.match.over) {
      this.enter('over');
      this.finished = true;
      cancelAnimationFrame(this.frame);
      const m = this.match;
      const why = m.wickets >= WICKETS ? 'All out' : `${BALLS_PER_INNINGS / 6} overs`;
      this.done.emit({ score: m.runs, detail: `${m.runs} runs for ${m.wickets} ${m.wickets === 1 ? 'wicket' : 'wickets'} · ${why}` });
      return;
    }
    this.call.set('');
    this.enter('ready');
  }

  // ---- drawing -------------------------------------------------------------------------------------------------------------------

  private px(x: number, y: number, w: number, h: number, colour = INK): void {
    this.ctx.fillStyle = colour;
    this.ctx.fillRect(Math.round(x), Math.round(y), w, h);
  }

  private draw(): void {
    const c = this.ctx;
    c.fillStyle = BG;
    c.fillRect(0, 0, LW, LH);
    // The ground: a mottled oval with a dotted boundary, and the pitch.
    c.fillStyle = MID;
    c.beginPath();
    c.ellipse(PITCH_X, 82, 56, 74, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = BG;
    c.beginPath();
    c.ellipse(PITCH_X, 82, 50, 68, 0, 0, Math.PI * 2);
    c.fill();
    for (let a = 0; a < 40; a++) {
      const th = (a / 40) * Math.PI * 2;
      this.px(PITCH_X + Math.cos(th) * 54, 82 + Math.sin(th) * 72, 1, 1);
    }
    this.px(PITCH_X - 6, 18, 12, 112, '#e6efc8');
    // Stumps at both ends.
    for (const y of [BOWLER_Y - 6, BAT_Y + 8]) for (const dx of [-3, 0, 3]) this.px(PITCH_X + dx, y, 1, 5);

    this.drawBowler();
    const batting = this.phase === 'play' && this.running?.start !== null && this.running !== null;
    if (!batting) this.drawBatter(PITCH_X, BAT_Y);
    this.drawRunners();

    if (this.phase === 'flight' || (this.phase === 'result' && !this.shot?.dist)) this.drawFlight();
    if (this.shot && this.shot.dist > 0 && (this.phase === 'play' || this.phase === 'result')) this.drawHit();
    this.drawBat();
  }

  private drawBowler(): void {
    const throwing = this.phase === 'ready' && this.t > 0.5;
    this.px(PITCH_X - 2, BOWLER_Y - 2, 4, 3); // head
    this.px(PITCH_X - 2, BOWLER_Y + 1, 4, 6); // body
    this.px(PITCH_X - 2, BOWLER_Y + 7, 1, 3);
    this.px(PITCH_X + 1, BOWLER_Y + 7, 1, 3);
    if (throwing) this.px(PITCH_X + 2, BOWLER_Y - 4, 1, 4);
  }

  private drawBatter(x: number, y: number): void {
    this.px(x - 2, y - 2, 4, 3);
    this.px(x - 2, y + 1, 4, 6);
    this.px(x - 2, y + 7, 1, 3);
    this.px(x + 1, y + 7, 1, 3);
  }

  /** The bat swings across the batter for a moment after a shot. */
  private drawBat(): void {
    if (this.phase === 'ready' || this.phase === 'over') return;
    const swinging = this.swung && this.t - (this.phase === 'flight' ? this.swingAt : 0) < 0.3 && this.phase !== 'result';
    const dir = this.swung === 'left' ? -1 : 1;
    if (swinging) {
      for (let i = 0; i < 6; i++) this.px(PITCH_X + dir * (3 + i * 1.4), BAT_Y + 3 - i * 1.6, 2, 2);
    } else if (this.phase === 'flight') {
      this.px(PITCH_X + 3, BAT_Y, 2, 7);
    }
  }

  private runnerY(from: number, to: number, start: number | null): number {
    if (start === null) return from;
    const p = Math.max(0, Math.min(1, (this.t - start) / RUN_SECONDS));
    return from + (to - from) * p;
  }

  private drawRunners(): void {
    if (this.phase !== 'play' || !this.running) {
      this.px(PITCH_X + 7, BOWLER_Y + 14, 3, 7); // the other batter, waiting at the far end
      return;
    }
    const r = this.running;
    // After an odd number of runs the batters have changed ends.
    const swapped = r.runs % 2 === 1;
    const a = swapped ? BOWLER_Y + 12 : BAT_Y;
    const b = swapped ? BAT_Y : BOWLER_Y + 12;
    if (r.start !== null) {
      this.drawBatter(PITCH_X - 4, this.runnerY(a, b, r.start));
      this.drawBatter(PITCH_X + 5, this.runnerY(b, a, r.start));
    } else {
      this.drawBatter(PITCH_X - 4, a);
      this.px(PITCH_X + 4, b, 3, 7);
    }
  }

  private drawFlight(): void {
    const y = 30 + this.flight * 90;
    const x = PITCH_X + this.delivery.line * 5 * Math.min(1, this.flight * 1.2);
    // A short trail, then the ball.
    this.px(x, y - 5, 1, 1, MID);
    this.px(x, y - 3, 1, 1, MID);
    this.px(x - 1, y, 3, 3);
  }

  private drawHit(): void {
    const s = this.shot!;
    const { fielded, returned } = fieldTimes(s.dist);
    const sx = PITCH_X;
    const sy = BAT_Y - 4;
    const dx = Math.sin(s.angle);
    const dy = -Math.cos(s.angle);
    const reach = Math.min(s.dist, BOUNDARY) * 1.05;
    const boundary = s.outcome === 'four' || s.outcome === 'six';
    const outP = Math.min(1, this.t / (boundary ? 0.7 : fielded));
    let x = sx + dx * reach * outP;
    let y = sy + dy * reach * outP;
    if (!boundary && this.t > fielded) {
      // The fielder throws it back to the bowler's end.
      const p = Math.min(1, (this.t - fielded) / (returned - fielded));
      x = x + (PITCH_X - x) * p;
      y = y + (BOWLER_Y + 6 - y) * p;
    }
    const arc = s.outcome === 'six' ? Math.sin(Math.min(1, outP) * Math.PI) * 10 : 0;
    this.px(x - 1, y - 1 - arc, 3, 3);
    // The fielder waits where the ball lands.
    if (!boundary || this.t > 0.5) {
      const fx = sx + dx * reach;
      const fy = sy + dy * reach;
      this.px(fx - 1, fy - 3, 3, 3);
      this.px(fx - 1, fy, 3, 4);
    }
  }
}
