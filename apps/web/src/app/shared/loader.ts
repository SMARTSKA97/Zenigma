import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** The Zenigma mark: seven tiles that trace a Z. It is also the loading indicator, so the brand is what people wait on. */
@Component({
  selector: 'app-loader',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.spin]': 'animate()',
    '[style.--s]': 'size() + "px"',
    role: 'img',
    '[attr.aria-label]': 'animate() ? "Loading" : "Zenigma"',
  },
  template: `
    @for (i of cells; track i) {
      <i [style.--n]="$index" [style.grid-area]="area(i)"></i>
    }
  `,
  styles: `
    :host {
      --gap: calc(var(--s) * 0.12);
      display: inline-grid;
      grid-template: repeat(3, 1fr) / repeat(3, 1fr);
      gap: var(--gap);
      width: var(--s);
      height: var(--s);
      color: inherit;
      flex: none;
    }
    i {
      border-radius: 28%;
      background: currentColor;
    }
    :host(.spin) i {
      animation: wave 1.1s var(--ease) infinite;
      animation-delay: calc(var(--n) * 0.09s);
    }
    @keyframes wave {
      0%,
      60%,
      100% {
        transform: scale(1);
        opacity: 1;
      }
      30% {
        transform: scale(0.45);
        opacity: 0.35;
      }
    }
  `,
})
export class Loader {
  readonly size = input(28);
  readonly animate = input(true);
  /** Cells of the 3x3 grid that form the Z, in drawing order (row, column). */
  protected readonly cells = ['1/1', '1/2', '1/3', '2/2', '3/1', '3/2', '3/3'];
  protected area(cell: string): string {
    const [row, col] = cell.split('/');
    return `${row} / ${col}`;
  }
}
