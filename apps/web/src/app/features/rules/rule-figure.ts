import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Figure } from './rules-data';

/** A small picture of a board, drawn from the cell strings described in rules-data.ts. */
@Component({
  selector: 'app-rule-figure',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure>
      <div class="fig" [style.--cols]="cols()" role="img" [attr.aria-label]="figure().caption">
        @for (row of figure().rows; track $index) {
          @for (cell of row; track $index) {
            <span [class]="classes(cell)">{{ text(cell) }}</span>
          }
        }
      </div>
      <figcaption>{{ figure().caption }}</figcaption>
    </figure>
  `,
  styles: `
    figure {
      margin: 0.6rem 0 0.9rem;
    }
    .fig {
      display: grid;
      grid-template-columns: repeat(var(--cols), minmax(0, 2.6rem));
      gap: 3px;
      width: max-content;
      max-width: 100%;
    }
    .fig span {
      display: grid;
      place-items: center;
      aspect-ratio: 1;
      min-width: 0;
      border-radius: 0.45rem;
      border: 1.5px solid color-mix(in srgb, var(--text) 22%, transparent);
      background: var(--surface);
      font-weight: 750;
      font-size: 1rem;
      line-height: 1;
    }
    .fig .good {
      outline: 3px solid #3a9d5d;
      outline-offset: -3px;
    }
    .fig .bad {
      outline: 3px solid var(--bad);
      outline-offset: -3px;
      color: var(--bad);
    }
    .fig .hint {
      outline: 3px solid #e0b020;
      outline-offset: -3px;
    }
    .fig .c0 { background: oklch(0.9 0.07 250); }
    .fig .c1 { background: oklch(0.9 0.08 60); }
    .fig .c2 { background: oklch(0.9 0.08 150); }
    .fig .c3 { background: oklch(0.9 0.08 330); }
    .fig .c4 { background: oklch(0.92 0.08 100); }
    .fig .c5 { background: oklch(0.9 0.07 200); }
    .fig .c6 { background: oklch(0.9 0.08 20); }
    .fig .c7 { background: oklch(0.93 0.09 90); }
    .fig span {
      color: #1c2326;
    }
    .fig .bad {
      color: #b3261e;
    }
    figcaption {
      margin-top: 0.4rem;
      color: var(--muted);
      font-size: 0.85rem;
      line-height: 1.4;
    }
  `,
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
