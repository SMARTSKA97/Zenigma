import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { gameInfo, levelCountOf, mapLink, TIERS, trackOf, variantsOf } from '../../games/catalog';
import { PracticeStore } from '../../games/puzzle/practice.store';
import { BackService } from '../../core/back.service';

/** The second page of a tiered kind (Sudoku Classic): pick how hard, Easy to Insane. Every tier has its own levels and map. */
@Component({
  selector: 'app-tier-picker',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="back" href="/" aria-label="Back" (click)="nav.up($event)">‹ {{ info()?.name }}</a>
    <h1>{{ info()?.name }} · {{ kind()?.name }}</h1>
    <p class="muted">{{ kind()?.blurb }} Pick how hard you want it. Each difficulty has its own levels and progress.</p>
    <div class="list">
      @for (t of tiers; track t.id; let i = $index) {
        <a class="card" [routerLink]="link(t.id)" [style.--step]="i">
          <span class="bars" aria-hidden="true">
            @for (b of [0, 1, 2, 3, 4]; track b) {
              <i [class.on]="b <= i"></i>
            }
          </span>
          <span class="text">
            <strong>{{ t.name }}</strong>
            <span class="muted">{{ t.blurb }}</span>
            <span class="tag">{{ progress(t.id) }}</span>
          </span>
          <span class="go" aria-hidden="true">›</span>
        </a>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      max-width: 36rem;
      margin: 0 auto;
    }
    .back {
      display: inline-block;
      margin-bottom: 0.75rem;
      color: var(--muted);
      text-decoration: none;
      font-weight: 600;
    }
    .list {
      display: grid;
      gap: 0.75rem;
      margin-top: 1.25rem;
    }
    .card {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 1rem;
      padding: 1rem;
      color: inherit;
      text-decoration: none;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      transition: transform 0.25s var(--ease), box-shadow 0.25s var(--ease);
    }
    .card:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-lift);
    }
    .bars {
      display: flex;
      align-items: flex-end;
      gap: 3px;
      width: 3.2rem;
      height: 2.4rem;
    }
    .bars i {
      flex: 1;
      border-radius: 3px;
      background: var(--surface-2);
    }
    .bars i:nth-child(1) { height: 30%; }
    .bars i:nth-child(2) { height: 45%; }
    .bars i:nth-child(3) { height: 60%; }
    .bars i:nth-child(4) { height: 80%; }
    .bars i:nth-child(5) { height: 100%; }
    .bars i.on {
      background: oklch(0.72 0.17 calc(150 - var(--step) * 32));
    }
    .text {
      display: grid;
      gap: 0.1rem;
    }
    .text strong {
      font-family: var(--font-display);
      font-size: 1.1rem;
    }
    .tag {
      margin-top: 0.3rem;
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--accent);
    }
    .go {
      font-size: 1.6rem;
      color: var(--muted);
    }
  `,
})
export class TierPicker implements OnInit {
  private readonly practice = inject(PracticeStore);
  protected readonly nav = inject(BackService);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);

  protected readonly tiers = TIERS;
  protected readonly game = computed(() => this.params()?.get('game') ?? 'sudoku');
  protected readonly kindId = computed(() => this.params()?.get('kind') ?? '');
  protected readonly info = computed(() => gameInfo(this.game()));
  protected readonly kind = computed(() => variantsOf(this.game()).find((v) => v.id === this.kindId()));

  ngOnInit(): void {
    for (const t of TIERS) void this.practice.load(this.track(t.id));
  }

  private track(tier: string): string {
    return trackOf(this.game(), `${this.kindId()}-${tier}`);
  }

  protected link(tier: string): string[] {
    return mapLink(this.game(), `${this.kindId()}-${tier}`);
  }

  protected progress(tier: string): string {
    const track = this.track(tier);
    const solved = this.practice.solvedLevels(track)().size;
    return solved ? `${solved} of ${levelCountOf(track)} solved · Level ${this.practice.frontier(track)} next` : `${levelCountOf(track)} levels · Start at level 1`;
  }
}
