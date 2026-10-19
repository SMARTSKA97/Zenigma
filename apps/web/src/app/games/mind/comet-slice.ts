import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, inject, output, signal, viewChild } from '@angular/core';
import { HapticsService } from '../../core/haptics.service';
import { advance, Body, H, RUN_SECONDS, segmentHitsCircle, throwBody, throwGap, W } from './comet-slice-engine';
import { MindResult } from './mind-util';

interface Pop {
  x: number;
  y: number;
  text: string;
  age: number;
}

/**
 * Fires are thrown up from the bottom. Swipe through them to collect them and keep clear of the skulls: slicing a skull ends
 * the run on the spot, with what you have. A fire that falls costs nothing. Slicing several in one swipe scores a bonus.
 * A run lasts 45 seconds, and the throws come faster and with more skulls as it goes.
 */
@Component({
  selector: 'app-comet-slice',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./mind.scss', './comet-slice.scss'],
  templateUrl: './comet-slice.html',
})
export class CometSlice implements OnInit, OnDestroy {
  readonly done = output<MindResult>();
  private readonly haptics = inject(HapticsService);
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('field');

  protected readonly score = signal(0);
  protected readonly left = signal(RUN_SECONDS);
  protected readonly combo = signal(0);
  protected readonly boom = signal(false);

  private bodies: Body[] = [];
  private pops: Pop[] = [];
  private trail: { x: number; y: number; age: number }[] = [];
  private sparks: { x: number; y: number; vx: number; vy: number; age: number; hue: number }[] = [];
  private swipeHits = 0;
  private seconds = 0;
  private untilThrow = 0.8;
  private frame = 0;
  private last = 0;
  private ended = false;
  private pointer: { x: number; y: number } | null = null;

  ngOnInit(): void {
    this.last = performance.now();
    this.frame = requestAnimationFrame((t) => this.loop(t));
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.frame);
  }

  private loop(now: number): void {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.update(dt);
    this.draw();
    if (!this.ended) this.frame = requestAnimationFrame((t) => this.loop(t));
  }

  private update(dt: number): void {
    this.seconds += dt;
    this.untilThrow -= dt;
    if (this.untilThrow <= 0) {
      // Later throws sometimes come in pairs.
      const n = this.seconds > 25 && Math.random() < 0.35 ? 2 : 1;
      for (let i = 0; i < n; i++) this.bodies.push(throwBody(this.seconds, Math.random));
      this.untilThrow = throwGap(this.seconds, Math.random);
    }
    for (const b of this.bodies) advance(b, dt);
    this.bodies = this.bodies.filter((b) => b.y - b.r <= H + 5 && !(b.sliced && b.age > 0 && b.y > H + b.r));
    this.left.set(Math.max(0, Math.ceil(RUN_SECONDS - this.seconds)));
    if (this.seconds >= RUN_SECONDS) this.end('Time!');
    for (const s of this.sparks) {
      s.age += dt;
      s.vy += 400 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
    }
    this.sparks = this.sparks.filter((s) => s.age < 0.6);
    for (const p of this.pops) p.age += dt;
    this.pops = this.pops.filter((p) => p.age < 0.8);
    for (const t of this.trail) t.age += dt;
    this.trail = this.trail.filter((t) => t.age < 0.18);
  }

  private end(text: string): void {
    if (this.ended) return;
    this.ended = true;
    this.pops.push({ x: W / 2, y: H / 2, text, age: 0 });
    cancelAnimationFrame(this.frame);
    this.draw();
    const n = this.score();
    setTimeout(() => this.done.emit({ score: n, detail: `${n} ${n === 1 ? 'fire' : 'fires'} collected${text === 'Time!' ? '' : ', a skull ended the run'}` }), 800);
  }

  protected down(event: PointerEvent): void {
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    this.pointer = this.toField(event);
    this.swipeHits = 0;
    this.slice(this.pointer, this.pointer);
  }

  protected move(event: PointerEvent): void {
    if (!this.pointer || this.ended) return;
    const to = this.toField(event);
    this.slice(this.pointer, to);
    this.pointer = to;
  }

  protected up(): void {
    this.pointer = null;
    this.swipeHits = 0;
  }

  private toField(event: PointerEvent): { x: number; y: number } {
    const box = this.canvasRef().nativeElement.getBoundingClientRect();
    return { x: ((event.clientX - box.left) / box.width) * W, y: ((event.clientY - box.top) / box.height) * H };
  }

  private slice(a: { x: number; y: number }, b: { x: number; y: number }): void {
    if (this.ended) return;
    this.trail.push({ x: b.x, y: b.y, age: 0 });
    for (const body of this.bodies) {
      if (body.sliced || !segmentHitsCircle(a.x, a.y, b.x, b.y, body.x, body.y, body.r)) continue;
      body.sliced = true;
      body.slicedAt = body.age;
      if (body.kind === 'comet') {
        // The second fire in one swipe is worth 2, the third 3, and so on.
        this.swipeHits++;
        this.score.update((s) => s + this.swipeHits);
        this.combo.set(this.swipeHits);
        this.haptics.tick();
        this.pops.push({ x: body.x, y: body.y, text: this.swipeHits > 1 ? `+${this.swipeHits} combo` : '+1', age: 0 });
        this.burst(body.x, body.y, 24, 8);
      } else {
        this.haptics.error();
        this.burst(body.x, body.y, 0, 14);
        this.boom.set(true);
        this.end('Skull!');
        return;
      }
    }
  }

  private burst(x: number, y: number, hue: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 140;
      this.sparks.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 60, age: 0, hue });
    }
  }

  private draw(): void {
    const canvas = this.canvasRef().nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const scale = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== W * scale) {
      canvas.width = W * scale;
      canvas.height = H * scale;
    }
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, W, H);
    for (const b of this.bodies) {
      if (b.sliced && b.kind === 'comet') {
        // Two halves drifting apart, fading as they cool.
        const since = b.age - (b.slicedAt ?? b.age);
        const apart = 8 + since * 80;
        ctx.globalAlpha = Math.max(0, 1 - since / 0.6);
        this.drawFire(ctx, b.x - apart, b.y + since * 40, b.r * 0.62, 0, 0);
        this.drawFire(ctx, b.x + apart, b.y + since * 40, b.r * 0.62, 0, 0);
        ctx.globalAlpha = 1;
      } else if (b.kind === 'comet') this.drawFire(ctx, b.x, b.y, b.r, b.vx, b.vy);
      else if (!b.sliced) this.drawSkull(ctx, b);
    }
    for (const s of this.sparks) {
      ctx.globalAlpha = Math.max(0, 1 - s.age / 0.6);
      ctx.fillStyle = `hsl(${s.hue + 12 * (1 - s.age)}, 100%, 60%)`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 3.2 * (1 - s.age / 0.8), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.lineCap = 'round';
    for (let i = 1; i < this.trail.length; i++) {
      const p = this.trail[i - 1];
      const q = this.trail[i];
      const fade = Math.max(0, 1 - q.age / 0.18);
      ctx.strokeStyle = `rgba(255,214,140,${fade * 0.55})`;
      ctx.lineWidth = 11;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${fade})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
      ctx.stroke();
    }
    ctx.font = '800 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const p of this.pops) {
      ctx.fillStyle = `rgba(255,255,255,${Math.max(0, 1 - p.age / 0.8)})`;
      ctx.fillText(p.text, p.x, p.y - p.age * 40);
    }
  }

  /** A ball of fire with a flame tail that trails behind the way it is moving. */
  private drawFire(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, vx: number, vy: number): void {
    const speed = Math.hypot(vx, vy);
    if (speed > 1) {
      const ux = -vx / speed;
      const uy = -vy / speed;
      for (let i = 4; i >= 1; i--) {
        ctx.fillStyle = `rgba(255,${90 + i * 25},40,${0.1 + 0.08 * (5 - i)})`;
        ctx.beginPath();
        ctx.arc(x + ux * r * 0.55 * i, y + uy * r * 0.55 * i, r * (1 - i * 0.14), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const glow = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * 1.5);
    glow.addColorStop(0, 'rgba(255,170,60,0.55)');
    glow.addColorStop(1, 'rgba(255,120,30,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.5, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.1, x, y, r);
    g.addColorStop(0, '#fffbe0');
    g.addColorStop(0.45, '#ffc533');
    g.addColorStop(1, '#f0561f');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  /** A skull on a dark orb with a red glow: never touch it. */
  private drawSkull(ctx: CanvasRenderingContext2D, b: Body): void {
    const { x, y, r } = b;
    const glow = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 1.6);
    glow.addColorStop(0, 'rgba(255,40,60,0.45)');
    glow.addColorStop(1, 'rgba(255,40,60,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#15121c';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ff4a5e';
    ctx.lineWidth = 3;
    ctx.stroke();
    // Skull: a rounded head over a jaw, two eyes, a nose and teeth.
    ctx.fillStyle = '#f2efe6';
    ctx.beginPath();
    ctx.arc(x, y - r * 0.12, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - r * 0.3, y + r * 0.15, r * 0.6, r * 0.38);
    ctx.fillStyle = '#15121c';
    ctx.beginPath();
    ctx.arc(x - r * 0.22, y - r * 0.12, r * 0.15, 0, Math.PI * 2);
    ctx.arc(x + r * 0.22, y - r * 0.12, r * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, y + r * 0.02);
    ctx.lineTo(x - r * 0.07, y + r * 0.15);
    ctx.lineTo(x + r * 0.07, y + r * 0.15);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#15121c';
    ctx.beginPath();
    for (let i = -1; i <= 1; i++) {
      ctx.moveTo(x + i * r * 0.14, y + r * 0.3);
      ctx.lineTo(x + i * r * 0.14, y + r * 0.53);
    }
    ctx.stroke();
  }
}
