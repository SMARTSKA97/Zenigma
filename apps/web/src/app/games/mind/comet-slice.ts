import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, inject, output, signal, viewChild } from '@angular/core';
import { HapticsService } from '../../core/haptics.service';
import { advance, Body, H, segmentHitsCircle, throwBody, throwGap, W } from './comet-slice-engine';
import { MindResult } from './mind-util';

interface Pop {
  x: number;
  y: number;
  text: string;
  age: number;
}

/**
 * Comets are thrown up from the bottom. Swipe through them to slice them; do not touch the bombs. A comet that falls
 * unsliced, or a bomb that is sliced, costs a life. Three lives. The throws come faster the longer you last.
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
  protected readonly lives = signal(3);

  private bodies: Body[] = [];
  private pops: Pop[] = [];
  private trail: { x: number; y: number; age: number }[] = [];
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
    for (const b of this.bodies) {
      advance(b, dt);
      if (b.missed && b.kind === 'comet' && !b.sliced) {
        b.sliced = true; // counted once; it is gone
        b.slicedAt = b.age - 1; // already faded: nothing is drawn for a comet that fell
        this.lose('Missed');
      }
    }
    this.bodies = this.bodies.filter((b) => b.y - b.r <= H + 5 && !(b.sliced && b.age > 0 && b.y > H + b.r));
    for (const p of this.pops) p.age += dt;
    this.pops = this.pops.filter((p) => p.age < 0.8);
    for (const t of this.trail) t.age += dt;
    this.trail = this.trail.filter((t) => t.age < 0.18);
  }

  private lose(text: string): void {
    if (this.ended) return;
    this.lives.update((l) => l - 1);
    this.haptics.error();
    this.pops.push({ x: W / 2, y: H - 40, text, age: 0 });
    if (this.lives() <= 0) {
      this.ended = true;
      cancelAnimationFrame(this.frame);
      this.draw();
      const n = this.score();
      setTimeout(() => this.done.emit({ score: n, detail: `${n} ${n === 1 ? 'comet' : 'comets'} sliced` }), 700);
    }
  }

  protected down(event: PointerEvent): void {
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    this.pointer = this.toField(event);
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
        this.score.update((s) => s + 1);
        this.haptics.tick();
        this.pops.push({ x: body.x, y: body.y, text: '+1', age: 0 });
      } else {
        this.pops.push({ x: body.x, y: body.y, text: 'Bomb!', age: 0 });
        this.lose('Bomb');
      }
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
        // Two halves drifting apart.
        const since = b.age - (b.slicedAt ?? b.age);
        const apart = 8 + since * 70;
        ctx.globalAlpha = Math.max(0, 1 - since / 0.7);
        this.drawComet(ctx, b.x - apart, b.y, b.r * 0.7);
        this.drawComet(ctx, b.x + apart, b.y, b.r * 0.7);
        ctx.globalAlpha = 1;
      } else if (b.kind === 'comet') this.drawComet(ctx, b.x, b.y, b.r);
      else this.drawBomb(ctx, b);
    }
    ctx.lineCap = 'round';
    for (let i = 1; i < this.trail.length; i++) {
      const p = this.trail[i - 1];
      const q = this.trail[i];
      ctx.strokeStyle = `rgba(255,255,255,${Math.max(0, 1 - q.age / 0.18)})`;
      ctx.lineWidth = 5;
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

  private drawComet(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    g.addColorStop(0, '#fff6c9');
    g.addColorStop(1, '#ff9a3c');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawBomb(ctx: CanvasRenderingContext2D, b: Body): void {
    ctx.fillStyle = b.sliced ? '#8a2b2b' : '#1b1d24';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ff5a5a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.x - 8, b.y - 8);
    ctx.lineTo(b.x + 8, b.y + 8);
    ctx.moveTo(b.x + 8, b.y - 8);
    ctx.lineTo(b.x - 8, b.y + 8);
    ctx.stroke();
  }
}
