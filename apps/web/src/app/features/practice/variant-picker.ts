import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { gameInfo, kindLink, leafIds, mapLink, TIERS, trackOf, variantsOf } from '../../games/catalog';
import { PracticeStore } from '../../games/puzzle/practice.store';
import { Glyph } from '../../shared/glyph';

/** Pick which kind of a game to practise (Sudoku: classic or mini). Every variant keeps its own level map and progress. */
@Component({
  selector: 'app-variant-picker',
  imports: [RouterLink, Glyph],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './variant-picker.html',
  styleUrl: './variant-picker.scss',
})
export class VariantPicker implements OnInit {
  private readonly practice = inject(PracticeStore);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);

  protected readonly game = computed(() => (this.params()?.get('game') ?? 'sudoku') as 'sudoku');
  protected readonly info = computed(() => gameInfo(this.game()));
  protected readonly variants = computed(() => variantsOf(this.game()));
  protected readonly playable = computed(() => this.variants().filter((v) => !v.soon));
  protected readonly soon = computed(() => this.variants().filter((v) => v.soon));

  ngOnInit(): void {
    for (const id of leafIds(this.game())) void this.practice.load(trackOf(this.game(), id));
  }

  protected link(variant: string, tiered?: boolean): string[] {
    return tiered ? kindLink(this.game(), variant) : mapLink(this.game(), variant);
  }

  protected progress(variant: string, tiered?: boolean): string {
    if (tiered) {
      const solved = TIERS.reduce((n, t) => n + this.practice.solvedLevels(trackOf(this.game(), `${variant}-${t.id}`))().size, 0);
      return solved ? `${solved} levels solved · 5 difficulties` : '5 difficulties, Easy to Insane';
    }
    const track = trackOf(this.game(), variant);
    const solved = this.practice.solvedLevels(track)().size;
    return solved ? `Level ${this.practice.frontier(track)} · ${solved} solved` : 'Start at level 1';
  }
}
