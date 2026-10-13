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
  templateUrl: './tier-picker.html',
  styleUrl: './tier-picker.scss',
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
