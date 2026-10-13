import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Sheet } from './sheet';

/** "Leave this game?" with a safe default: staying. Back and the scrim also mean stay. */
@Component({
  selector: 'app-leave-sheet',
  imports: [Sheet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './leave-sheet.html',
  styleUrl: './leave-sheet.scss',
})
export class LeaveSheet {
  readonly text = input('');
  readonly answer = output<boolean>();
}
