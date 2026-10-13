import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { HapticsService } from '../../core/haptics.service';

import { nextCell, SIZE, TangoCell, TangoPuzzle } from './engine';

@Component({
  selector: 'app-tango-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tango-board.html',
  styleUrl: './tango-board.scss',
})
export class TangoBoard {
  private readonly haptics = inject(HapticsService);
  readonly puzzle = input.required<TangoPuzzle>();
  readonly board = input.required<TangoCell[]>();
  readonly bad = input<Set<number>>(new Set());
  readonly locked = input(false);
  readonly solved = input(false);
  readonly boardChange = output<TangoCell[]>();

  protected readonly rays = [0, 45, 90, 135, 180, 225, 270, 315];

  protected readonly cells = computed(() => {
    const puzzle = this.puzzle();
    const bad = this.bad();
    return this.board().map((value, i) => ({
      i,
      delay: ((i % SIZE) + Math.floor(i / SIZE)) * 0.05 + 's',
      value,
      given: puzzle.givens[i] !== '.',
      bad: bad.has(i),
      label: `Row ${Math.floor(i / SIZE) + 1}, column ${(i % SIZE) + 1}, ${value === 's' ? 'sun' : value === 'm' ? 'moon' : 'empty'}${puzzle.givens[i] !== '.' ? ', fixed' : ''}`,
    }));
  });

  /** Signs sit on the line between the two cells they describe. */
  protected readonly edges = computed(() =>
    this.puzzle().edges.map(([a, b, kind]) => {
      const horizontal = b === a + 1;
      const x = horizontal ? ((a % SIZE) + 1) * (100 / SIZE) : ((a % SIZE) + 0.5) * (100 / SIZE);
      const y = horizontal ? (Math.floor(a / SIZE) + 0.5) * (100 / SIZE) : (Math.floor(a / SIZE) + 1) * (100 / SIZE);
      return { key: `${a}-${b}`, kind, x, y };
    }),
  );

  protected tap(index: number): void {
    const next = [...this.board()];
    next[index] = nextCell(next[index]);
    if (next[index] !== '.') this.haptics.tap();
    else this.haptics.tick();
    this.boardChange.emit(next);
  }
}
