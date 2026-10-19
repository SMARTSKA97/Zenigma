import { ChangeDetectionStrategy, Component, computed, ElementRef, OnDestroy, OnInit, inject, input, output, signal, viewChild } from '@angular/core';
import { HapticsService } from '../../core/haptics.service';
import { advance, Body, H, HEARTS, RUN_SECONDS, segmentHitsCircle, throwBody, throwGap, W } from './comet-slice-engine';
import { MindResult, seeded } from './mind-util';

interface Pop {
  x: number;
  y: number;
  text: string;
  age: number;
}

interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  age: number;
  gold: boolean;
}

/** Stars are the same every time, so the sky does not jump about between frames. */
const STARS = (() => {
  const random = seeded('comet-slice-stars');
  return Array.from({ length: 46 }, () => ({ x: random() * W, y: random() * H * 0.9, r: 0.6 + random() * 1.4, phase: random() * 6 }));
})();

/**
 * Comets and skulls fall from the top of a night sky, each at its own speed, and everything gets faster the longer you last.
 * Swipe through the comets to collect them (several in one swipe is a combo). A comet that reaches the ground costs a heart, and
 * three hearts is the end. A skull is the end at once: slice one and the run is over, with a huge jolt. Practice has no clock:
 * keep going and beat your best. The daily (`seed`) has a one-minute clock and throws the same comets and skulls at everyone.
 */
@Component({
  selector: 'app-comet-slice',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./mind.scss', './comet-slice.scss'],
  templateUrl: './comet-slice.html',
})
export class CometSlice implements OnInit, OnDestroy {
  readonly done = output<MindResult>();
  /** Set for the daily: the same throws for everyone. */
  readonly seed = input<string | null>(null);
  private readonly haptics = inject(HapticsService);
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('field');

  protected readonly score = signal(0);
  protected readonly left = signal(RUN_SECONDS);
  protected readonly lives = signal(HEARTS);
  /** Practice counts up from the start (it has no end but the hearts). */
  protected readonly elapsed = signal('0:00');
  protected readonly boom = signal(false);
  /** True for a moment after a heart is lost, so the hearts shake and flash. */
  protected readonly hit = signal(false);
  protected readonly timed = computed(() => this.seed() !== null);

  private random: () => number = Math.random;
  private bodies: Body[] = [];
  private pops: Pop[] = [];
  private bits: Bit[] = [];
  private trail: { x: number; y: number; age: number }[] = [];
  private seconds = 0;
  private untilThrow = 0.7;
  private frame = 0;
  private last = 0;
  private ended = false;
  private swipeHits = 0;
  private rings: { x: number; y: number; age: number; life: number; size: number; colour: string }[] = [];
  private shake = 0;
  private flash = 0;
  private finished = false;
  private pointer: { x: number; y: number } | null = null;

  ngOnInit(): void {
    const seed = this.seed();
    if (seed !== null) this.random = seeded(seed);
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
    if (!this.finished) this.frame = requestAnimationFrame((t) => this.loop(t));
  }

  private update(dt: number): void {
    this.seconds += dt;
    if (!this.ended) this.untilThrow -= dt;
    if (!this.ended && this.untilThrow <= 0) {
      // Later throws sometimes come in pairs.
      const n = this.seconds > 20 && this.random() < 0.35 ? 2 : 1;
      for (let i = 0; i < n; i++) this.bodies.push(throwBody(this.seconds, this.random));
      this.untilThrow = throwGap(this.seconds, this.random);
    }
    for (const b of this.bodies) {
      advance(b, dt);
      if (b.missed && b.kind === 'comet' && !b.counted && !this.ended) {
        b.counted = true;
        this.ring(Math.min(W - 20, Math.max(20, b.x)), H - 8, 'rgba(255,140,90,0.9)', 46, 0.5);
        this.lose('Missed');
      }
    }
    this.bodies = this.bodies.filter((b) => b.y - b.r <= H + 40 && !(b.sliced && b.age - (b.slicedAt ?? 0) > 0.7));
    if (this.ended) {
      // The run is over: let the blast play out.
    } else if (!this.timed()) {
      const t = Math.floor(this.seconds);
      this.elapsed.set(`${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`);
    } else {
      this.left.set(Math.max(0, Math.ceil(RUN_SECONDS - this.seconds)));
      if (this.seconds >= RUN_SECONDS) this.end('Time!');
    }
    for (const s of this.bits) {
      s.age += dt;
      s.vy += 260 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
    }
    this.bits = this.bits.filter((s) => s.age < 0.7);
    for (const r of this.rings) r.age += dt;
    this.rings = this.rings.filter((r) => r.age < r.life);
    this.shake = Math.max(0, this.shake - dt * 30);
    this.flash = Math.max(0, this.flash - dt * 2.2);
    for (const p of this.pops) p.age += dt;
    this.pops = this.pops.filter((p) => p.age < 0.8);
    for (const t of this.trail) t.age += dt;
    this.trail = this.trail.filter((t) => t.age < 0.22);
  }

  private ring(x: number, y: number, colour: string, size: number, life: number): void {
    this.rings.push({ x, y, age: 0, life, size, colour });
  }

  /** A comet got past: a heart goes, with a shake and a short buzz. */
  private lose(text: string): void {
    if (this.ended) return;
    this.lives.update((l) => l - 1);
    this.swipeHits = 0;
    this.haptics.error();
    this.shake = Math.max(this.shake, 6);
    this.hit.set(true);
    setTimeout(() => this.hit.set(false), 520);
    this.pops.push({ x: W / 2, y: H - 70, text, age: 0 });
    if (this.lives() <= 0) this.end('Game over');
  }

  /** The run is over. The last moments keep animating, then the result is handed on. */
  private end(text: string): void {
    if (this.ended) return;
    this.ended = true;
    this.pops.push({ x: W / 2, y: H / 2, text, age: 0 });
    const n = this.score();
    setTimeout(() => {
      this.finished = true;
      cancelAnimationFrame(this.frame);
      this.done.emit({ score: n, detail: `${n} ${n === 1 ? 'point' : 'points'}${text === 'Time!' ? ', time up' : text === 'Boom!' ? ', a skull ended the run' : ''}` });
    }, text === 'Boom!' ? 1100 : 700);
  }

  protected down(event: PointerEvent): void {
    // Press and drag, with a mouse or a finger. The pointer is captured, so a swipe carries on even if it leaves the field.
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
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
        // The second comet in one swipe is worth 2, the third 3, and so on.
        this.swipeHits++;
        this.score.update((s) => s + this.swipeHits);
        this.haptics.place();
        this.pops.push({ x: body.x, y: body.y, text: this.swipeHits > 1 ? `+${this.swipeHits} combo` : '+1', age: 0 });
        this.burst(body.x, body.y, 12);
        this.ring(body.x, body.y, 'rgba(255,255,255,0.85)', 34, 0.35);
      } else {
        // A skull ends everything: a huge jolt, a blast and a flash.
        this.haptics.boom();
        this.burst(body.x, body.y, 40);
        this.ring(body.x, body.y, 'rgba(255,200,80,0.95)', 140, 0.7);
        this.ring(body.x, body.y, 'rgba(255,90,60,0.8)', 90, 0.5);
        this.shake = 16;
        this.flash = 1;
        this.boom.set(true);
        this.lives.set(0);
        this.end('Boom!');
        return;
      }
    }
  }

  private burst(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 150;
      this.bits.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 40, r: 1.5 + Math.random() * 4, age: 0, gold: Math.random() < 0.25 });
    }
  }

  // ---- drawing ----

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
    this.drawSky(ctx);
    if (this.shake > 0) ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    for (const b of this.bodies) {
      if (b.kind === 'comet') {
        if (b.sliced) this.drawHalves(ctx, b);
        else this.drawComet(ctx, b);
      } else if (!b.sliced) this.drawSkull(ctx, b);
    }
    for (const s of this.bits) {
      ctx.globalAlpha = Math.max(0, 1 - s.age / 0.7);
      ctx.fillStyle = s.gold ? '#ffc94d' : '#ffffff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const r of this.rings) {
      const t = r.age / r.life;
      ctx.globalAlpha = Math.max(0, 1 - t);
      ctx.strokeStyle = r.colour;
      ctx.lineWidth = 6 * (1 - t) + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.size * (1 - (1 - t) ** 3), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    this.drawSwipe(ctx);
    ctx.font = '800 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const p of this.pops) {
      ctx.fillStyle = `rgba(255,255,255,${Math.max(0, 1 - p.age / 0.8)})`;
      ctx.fillText(p.text, p.x, p.y - p.age * 40);
    }
    this.drawScore(ctx);
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,230,180,${this.flash * 0.7})`;
      ctx.fillRect(-20, -20, W + 40, H + 40);
    }
  }

  /** Night sky of our own: midnight blue deepening to teal, a soft green glow, a low moon, stars and dark ridges along the ground. */
  private drawSky(ctx: CanvasRenderingContext2D): void {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#050b1f');
    sky.addColorStop(0.55, '#0b2a4a');
    sky.addColorStop(1, '#127a80');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    // Faint glow low on the horizon.
    const glow = ctx.createRadialGradient(W * 0.3, H, 10, W * 0.3, H, 320);
    glow.addColorStop(0, 'rgba(90,255,200,0.28)');
    glow.addColorStop(1, 'rgba(90,255,200,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    // A low moon.
    ctx.fillStyle = 'rgba(214,238,255,0.9)';
    ctx.beginPath();
    ctx.arc(W * 0.8, H - 120, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(214,238,255,0.15)';
    ctx.beginPath();
    ctx.arc(W * 0.8, H - 120, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    for (const s of STARS) {
      ctx.globalAlpha = 0.45 + 0.4 * Math.sin(this.seconds * 1.6 + s.phase);
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#0a4a56';
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, H - 50);
    ctx.lineTo(50, H - 74);
    ctx.lineTo(95, H - 48);
    ctx.lineTo(150, H - 84);
    ctx.lineTo(210, H - 46);
    ctx.lineTo(265, H - 70);
    ctx.lineTo(W, H - 44);
    ctx.lineTo(W, H);
    ctx.fill();
    ctx.fillStyle = '#06303a';
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, H - 24);
    ctx.lineTo(70, H - 40);
    ctx.lineTo(140, H - 20);
    ctx.lineTo(220, H - 38);
    ctx.lineTo(W, H - 18);
    ctx.lineTo(W, H);
    ctx.fill();
  }

  private drawScore(ctx: CanvasRenderingContext2D): void {
    const w = 78;
    const h = 28;
    const x = (W - w) / 2;
    const y = 12;
    ctx.fillStyle = 'rgba(30,120,150,0.55)';
    ctx.strokeStyle = 'rgba(170,235,240,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 14);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = '700 17px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(this.score()), W / 2, y + 20);
  }

  /** A white thick stroke that thins out towards where the swipe began. */
  private drawSwipe(ctx: CanvasRenderingContext2D): void {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 1; i < this.trail.length; i++) {
      const p = this.trail[i - 1];
      const q = this.trail[i];
      const fade = Math.max(0, 1 - q.age / 0.22);
      ctx.strokeStyle = `rgba(255,255,255,${fade})`;
      ctx.lineWidth = 3 + 11 * (i / this.trail.length) * fade;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
      ctx.stroke();
    }
  }

  /** A pale cratered rock with a long tapering tail: orange where it is hot, pink, then fading into violet. */
  private drawComet(ctx: CanvasRenderingContext2D, b: Body): void {
    const speed = Math.hypot(b.vx, b.vy) || 1;
    const ux = -b.vx / speed;
    const uy = -b.vy / speed;
    const head = b.r * 0.72;
    const length = 70 + speed * 0.55;
    const tx = b.x + ux * length;
    const ty = b.y + uy * length;
    const nx = -uy;
    const ny = ux;
    const tail = ctx.createLinearGradient(b.x, b.y, tx, ty);
    tail.addColorStop(0, 'rgba(255,170,60,0.95)');
    tail.addColorStop(0.35, 'rgba(255,100,200,0.8)');
    tail.addColorStop(1, 'rgba(110,60,220,0)');
    for (const [spread, alpha] of [[1.18, 0.35], [1, 1]] as const) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = spread > 1 ? 'rgba(255,190,90,0.55)' : tail;
      ctx.beginPath();
      ctx.moveTo(b.x + nx * head * spread, b.y + ny * head * spread);
      ctx.lineTo(tx, ty);
      ctx.lineTo(b.x - nx * head * spread, b.y - ny * head * spread);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffc861';
    ctx.beginPath();
    ctx.arc(b.x, b.y, head * 1.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fbf8ff';
    ctx.beginPath();
    ctx.arc(b.x, b.y, head, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(150,140,175,0.55)';
    for (const [dx, dy, r] of [[-0.35, -0.25, 0.16], [0.25, 0.1, 0.12], [-0.05, 0.4, 0.1]]) {
      ctx.beginPath();
      ctx.arc(b.x + dx * head, b.y + dy * head, r * head, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** A cut comet: two white halves that fly apart and fade. */
  private drawHalves(ctx: CanvasRenderingContext2D, b: Body): void {
    const since = b.age - (b.slicedAt ?? b.age);
    const apart = 6 + since * 90;
    ctx.globalAlpha = Math.max(0, 1 - since / 0.7);
    ctx.fillStyle = '#fbf8ff';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(b.x + side * apart, b.y + since * 60, b.r * 0.5, side < 0 ? Math.PI / 2 : -Math.PI / 2, side < 0 ? (Math.PI * 3) / 2 : Math.PI / 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** A dark, angry face wrapped in a flickering yellow and orange flame. */
  private drawSkull(ctx: CanvasRenderingContext2D, b: Body): void {
    const { x, y, r } = b;
    const flicker = Math.sin(this.seconds * 14 + b.id) * 0.06;
    for (const [scale, colour] of [[1.25, 'rgba(255,140,40,0.75)'], [1.02, 'rgba(255,214,90,0.95)']] as const) {
      ctx.fillStyle = colour;
      ctx.beginPath();
      const tongues = 7;
      for (let i = 0; i <= tongues * 2; i++) {
        // Flames point up: spikes on the top half, a rounded bottom.
        const angle = Math.PI + (i / (tongues * 2)) * Math.PI * 2;
        const spike = i % 2 === 0 ? 1 : 0.78;
        const up = Math.sin(angle) < -0.2 ? 1 + flicker * (i % 3) : 0.82;
        const rr = r * scale * 0.92 * spike * up;
        const px = x + Math.cos(angle) * rr;
        const py = y + Math.sin(angle) * rr * (Math.sin(angle) < 0 ? 1.15 : 0.92);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#1a1442';
    ctx.beginPath();
    ctx.arc(x, y + r * 0.05, r * 0.66, 0, Math.PI * 2);
    ctx.fill();
    // Angry eyes.
    ctx.fillStyle = '#ffe36a';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(x + side * r * 0.25, y - r * 0.02, r * 0.13, r * 0.1, side * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#ffe36a';
    ctx.lineWidth = r * 0.07;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.42, y - r * 0.22);
    ctx.lineTo(x - r * 0.1, y - r * 0.1);
    ctx.moveTo(x + r * 0.42, y - r * 0.22);
    ctx.lineTo(x + r * 0.1, y - r * 0.1);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y + r * 0.36, r * 0.17, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }
}
