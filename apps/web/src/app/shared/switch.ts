import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

/** An accessible on/off switch built on a real checkbox. */
@Component({
  selector: 'app-switch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label>
      <input type="checkbox" role="switch" [checked]="checked()" [disabled]="disabled()" (change)="checked.set($any($event.target).checked)" />
      <span class="text"><ng-content /></span>
      <span class="track" aria-hidden="true"><span class="knob"></span></span>
    </label>
  `,
  styles: `
    label {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 0.75rem;
      cursor: pointer;
      color: var(--text);
      font-size: 0.95rem;
    }
    input {
      position: absolute;
      opacity: 0;
      width: 1px;
      height: 1px;
      min-height: 0;
    }
    .track {
      position: relative;
      flex: none;
      width: 46px;
      height: 28px;
      border-radius: 999px;
      background: var(--surface-2);
      border: 1px solid var(--border);
      transition: background-color 0.25s var(--ease);
    }
    .knob {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: var(--surface);
      box-shadow: 0 1px 3px rgb(0 0 0 / 0.3);
      transition: transform 0.3s var(--spring);
    }
    input:checked + .track {
      background: var(--ink);
      border-color: var(--ink);
    }
    input:checked + .track .knob {
      transform: translateX(18px);
      background: var(--ink-contrast);
    }
    input:focus-visible + .track {
      outline: 2px solid var(--accent);
      outline-offset: 3px;
    }
    input:disabled + .track {
      opacity: 0.5;
    }
    .text {
      flex: 1;
    }

    /* Android: Material 3 switch. A small outlined thumb that grows and fills when on. */
    :host-context([data-platform='android']) .track {
      width: 52px;
      height: 32px;
      background: transparent;
      border: 2px solid var(--muted);
    }
    :host-context([data-platform='android']) .knob {
      top: 6px;
      left: 6px;
      width: 16px;
      height: 16px;
      background: var(--muted);
      box-shadow: none;
      transition:
        transform 0.3s var(--spring),
        width 0.2s var(--ease),
        height 0.2s var(--ease),
        top 0.2s var(--ease),
        left 0.2s var(--ease),
        background-color 0.2s var(--ease);
    }
    :host-context([data-platform='android']) input:checked + .track {
      background: var(--accent);
      border-color: var(--accent);
    }
    :host-context([data-platform='android']) input:checked + .track .knob {
      top: 2px;
      left: 2px;
      width: 24px;
      height: 24px;
      transform: translateX(20px);
      background: var(--accent-contrast);
    }
    label {
      justify-content: space-between;
    }
  `,
})
export class Switch {
  readonly checked = model(false);
  readonly disabled = input(false);
}
