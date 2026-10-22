import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { BackService } from '../core/back.service';

/** A modal bottom sheet on phones and a centred dialog on larger screens. Drag the handle down (or tap it, or the dimmed area) to put it away. */
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
  /** How far the sheet has been dragged down, in pixels. */
  protected readonly drag = signal(0);
  protected readonly dragging = signal(false);
  private startY = 0;
  private moved = false;

  constructor() {
    // The Android Back button closes the open sheet before it goes anywhere else.
    const unregister = inject(BackService).registerOverlay(() => {
      if (this.dismissible()) this.closed.emit();
    });
    inject(DestroyRef).onDestroy(unregister);
  }

  protected grabStart(event: PointerEvent): void {
    if (!this.dismissible()) return;
    this.startY = event.clientY;
    this.moved = false;
    this.dragging.set(true);
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  protected grabMove(event: PointerEvent): void {
    if (!this.dragging()) return;
    const dy = Math.max(0, event.clientY - this.startY);
    if (dy > 4) this.moved = true;
    this.drag.set(dy);
  }

  protected grabEnd(event: PointerEvent): void {
    if (!this.dragging()) return;
    this.dragging.set(false);
    const far = this.drag() > 90;
    this.drag.set(0);
    // A drag past a little way, or a plain tap on the handle, puts the sheet away.
    if (far || (!this.moved && event.type === 'pointerup')) this.closed.emit();
  }
}
