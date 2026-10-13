import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface RadarAxis {
  label: string;
  /** 0 to 100 */
  you: number;
  other: number | null;
}

/** A six-point radar chart: you against another group (or against the "excellent" ring). */
@Component({
  selector: 'app-radar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './radar.html',
  styleUrl: './radar.scss',
})
export class Radar {
  readonly axes = input.required<RadarAxis[]>();
  readonly otherLabel = input('Average');

  private readonly c = 130;
  private readonly r = 88;
  protected readonly rings = [25, 50, 75, 100];

  private point(i: number, n: number, value: number): [number, number] {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const radius = (this.r * Math.max(0, Math.min(100, value))) / 100;
    return [this.c + Math.cos(angle) * radius, this.c + Math.sin(angle) * radius];
  }

  private path(values: number[]): string {
    return values.map((v, i) => this.point(i, values.length, v).map((n) => n.toFixed(1)).join(',')).join(' ');
  }

  protected readonly grid = computed(() => this.rings.map((ring) => this.path(this.axes().map(() => ring))));
  protected readonly spokes = computed(() => this.axes().map((_, i) => this.point(i, this.axes().length, 100)));
  protected readonly you = computed(() => this.path(this.axes().map((a) => a.you)));
  protected readonly other = computed(() => (this.axes().some((a) => a.other !== null) ? this.path(this.axes().map((a) => a.other ?? 0)) : null));
  protected readonly labels = computed(() =>
    this.axes().map((a, i) => {
      const [x, y] = this.point(i, this.axes().length, 122);
      return { x, y, text: a.label, anchor: x < this.c - 6 ? 'end' : x > this.c + 6 ? 'start' : 'middle' };
    }),
  );
  protected readonly dots = computed(() => this.axes().map((a, i) => this.point(i, this.axes().length, a.you)));
}
