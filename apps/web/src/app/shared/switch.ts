import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * An on/off switch. It is a plain button with role="switch" and shows exactly what its parent says (`checked`):
 * a tap asks for the opposite through `checkedChange`, and nothing changes until the parent agrees (so a refused
 * permission, for example, leaves the switch off).
 */
@Component({
  selector: 'app-switch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="sw" role="switch" [attr.aria-checked]="checked()" [disabled]="disabled()" (click)="checkedChange.emit(!checked())">
      <span class="text"><ng-content /></span>
      <span class="track" aria-hidden="true"><span class="knob"></span></span>
    </button>
  `,
  styles: `
    :host {
      display: block;
    }
    /* Reset everything the global (and Android Material) button styles add, so only this layout applies. */
    :host .sw {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      width: 100%;
      min-height: 0;
      height: auto;
      margin: 0;
      padding: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
      color: var(--text);
      font: inherit;
      font-size: 0.95rem;
      font-weight: 500;
      letter-spacing: 0;
      text-align: left;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    :host .sw:disabled {
      opacity: 0.55;
      cursor: default;
    }
    .text {
      flex: 1;
      min-width: 0;
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
    .sw[aria-checked='true'] .track {
      background: var(--ink);
      border-color: var(--ink);
    }
    .sw[aria-checked='true'] .knob {
      transform: translateX(18px);
      background: var(--ink-contrast);
    }
    .sw:focus-visible .track {
      outline: 2px solid var(--accent);
      outline-offset: 3px;
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
    :host-context([data-platform='android']) .sw[aria-checked='true'] .track {
      background: var(--accent);
      border-color: var(--accent);
    }
    :host-context([data-platform='android']) .sw[aria-checked='true'] .knob {
      top: 2px;
      left: 2px;
      width: 24px;
      height: 24px;
      transform: translateX(20px);
      background: var(--accent-contrast);
    }
  `,
})
export class Switch {
  readonly checked = input(false);
  readonly disabled = input(false);
  readonly checkedChange = output<boolean>();
}
