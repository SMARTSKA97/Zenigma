import { ChangeDetectionStrategy, Component, input } from '@angular/core';
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

  private parse(cell: string): { mark: string; colour: string; text: string } {
    let rest = cell ?? '';
    let mark = '';
    if (/^[+!?]/.test(rest)) {
      mark = rest[0];
      rest = rest.slice(1);
    }
    let colour = '';
    const colourMatch = /^#([0-7])/.exec(rest);
    if (colourMatch) {
      colour = colourMatch[1];
      rest = rest.slice(1 + colourMatch[0].length - 1);
    }
    return { mark, colour, text: rest === '.' ? '' : rest };
  }

  protected text(cell: string): string {
    return this.parse(cell).text;
  }

  protected classes(cell: string): string {
    const p = this.parse(cell);
    return [p.colour ? 'c' + p.colour : '', p.mark === '+' ? 'good' : p.mark === '!' ? 'bad' : p.mark === '?' ? 'hint' : ''].filter(Boolean).join(' ');
  }
}
