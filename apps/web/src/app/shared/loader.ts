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
  templateUrl: './loader.html',
  styleUrl: './loader.scss',
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
