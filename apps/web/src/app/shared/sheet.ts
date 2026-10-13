import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, output } from '@angular/core';
import { BackService } from '../core/back.service';

/** A modal bottom sheet on phones and a centred dialog on larger screens. */
@Component({
  selector: 'app-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'dismissible() && closed.emit()' },
  template: `
    <div class="scrim" (click)="dismissible() && closed.emit()"></div>
    <section class="sheet" role="dialog" aria-modal="true" [attr.aria-label]="label()">
      <div class="handle" aria-hidden="true"></div>
      <ng-content />
    </section>
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 100;
      display: grid;
      align-items: end;
      justify-items: center;
    }
    .scrim {
      position: absolute;
      inset: 0;
      background: rgb(8 12 14 / 0.5);
      animation: fade 0.25s var(--ease);
    }
    .sheet {
      position: relative;
      width: min(100%, 30rem);
      max-height: 88dvh;
      overflow: auto;
      padding: 0.5rem 1.5rem calc(1.5rem + env(safe-area-inset-bottom));
      background: var(--surface);
      color: var(--text);
      border-radius: 28px 28px 0 0;
      box-shadow: var(--shadow-lift);
      animation: up 0.42s var(--spring);
    }
    .handle {
      width: 32px;
      height: 4px;
      margin: 0.5rem auto 1rem;
      border-radius: 99px;
      background: var(--border);
    }
    @keyframes fade {
      from {
        opacity: 0;
      }
    }
    @keyframes up {
      from {
        transform: translateY(100%);
      }
    }
    @media (min-width: 640px) {
      :host {
        align-items: center;
      }
      .sheet {
        border-radius: 28px;
        padding-bottom: 1.5rem;
      }
      .handle {
        display: none;
      }
    }
  `,
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
