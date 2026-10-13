import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, output } from '@angular/core';
import { BackService } from '../core/back.service';

/** A modal bottom sheet on phones and a centred dialog on larger screens. */
@Component({
  selector: 'app-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'dismissible() && closed.emit()' },
  templateUrl: './sheet.html',
  styleUrl: './sheet.scss',
})
export class Sheet {
  readonly label = input('');
  readonly dismissible = input(true);
  readonly closed = output<void>();

  constructor() {
    // The Android Back button closes the open sheet before it goes anywhere else.
    const unregister = inject(BackService).registerOverlay(() => {
      if (this.dismissible()) this.closed.emit();
    });
    inject(DestroyRef).onDestroy(unregister);
  }
}
