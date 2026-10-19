import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { cellClasses, parseCell } from './cell';
import { Figure } from './rules-data';

/** A small picture of a board, drawn from the cell strings described in rules-data.ts. */
@Component({
  selector: 'app-rule-figure',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rule-figure.html',
  styleUrl: './rule-figure.scss',
})
export class RuleFigure {
  readonly figure = input.required<Figure>();

  protected cols(): number {
    return Math.max(...this.figure().rows.map((r) => r.length));
  }

  protected text(cell: string): string {
    return parseCell(cell).text;
  }

  protected classes(cell: string): string {
    return cellClasses(cell);
  }
}
