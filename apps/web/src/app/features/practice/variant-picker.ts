import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { gameInfo, mapLink, trackOf, variantsOf } from '../../games/catalog';
import { PracticeStore } from '../../games/puzzle/practice.store';
import { Glyph } from '../../shared/glyph';

/** Pick which kind of a game to practise (Sudoku: classic or mini). Every variant keeps its own level map and progress. */
@Component({
  selector: 'app-variant-picker',
  imports: [RouterLink, Glyph],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="back" routerLink="/practice" aria-label="Back to practice">‹ Practice</a>
    <h1>{{ info()?.name }}</h1>
    <p class="muted">Choose a kind. Each has its own levels and progress.</p>
    <div class="list">
      @for (v of variants(); track v.id) {
        <a class="card" [routerLink]="link(v.id)" [style.--h]="info()?.hue">
          <span class="art"><app-glyph [game]="game()" /></span>
          <span class="text">
            <strong>{{ v.name }}</strong>
            <span class="muted">{{ v.blurb }}</span>
            <span class="tag">{{ progress(v.id) }}</span>
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
    .art {
      width: 3.5rem;
      height: 3.5rem;
      padding: 0.6rem;
      border-radius: 16px;
      background: oklch(var(--tile-l) var(--tile-c) calc(var(--h) * 1deg));
      color: oklch(var(--glyph-l) var(--glyph-c) calc(var(--h) * 1deg));
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
export class VariantPicker implements OnInit {
  private readonly practice = inject(PracticeStore);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);

  protected readonly game = computed(() => (this.params()?.get('game') ?? 'sudoku') as 'sudoku');
  protected readonly info = computed(() => gameInfo(this.game()));
  protected readonly variants = computed(() => variantsOf(this.game()));

  ngOnInit(): void {
    for (const v of this.variants()) void this.practice.load(trackOf(this.game(), v.id));
  }

  protected link(variant: string): string[] {
    return mapLink(this.game(), variant);
  }

  protected progress(variant: string): string {
    const track = trackOf(this.game(), variant);
    const solved = this.practice.solvedLevels(track)().size;
    return solved ? `Level ${this.practice.frontier(track)} · ${solved} solved` : 'Start at level 1';
  }
}
