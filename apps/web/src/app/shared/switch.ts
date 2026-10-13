import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * An on/off switch. It is a plain button with role="switch" and shows exactly what its parent says (`checked`):
 * a tap asks for the opposite through `checkedChange`, and nothing changes until the parent agrees (so a refused
 * permission, for example, leaves the switch off).
 */
@Component({
  selector: 'app-switch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './switch.html',
  styleUrl: './switch.scss',
})
export class Switch {
  readonly checked = input(false);
  readonly disabled = input(false);
  readonly checkedChange = output<boolean>();
}
