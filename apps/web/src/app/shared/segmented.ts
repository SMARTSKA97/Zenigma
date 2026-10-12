import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

/** A pill-shaped switcher with a thumb that slides to the chosen option. */
@Component({
  selector: 'app-segmented',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'radiogroup', '[attr.aria-label]': 'label()', '[style.--count]': 'options().length', '[style.--index]': 'index()' },
  template: `
    <span class="thumb" aria-hidden="true"></span>
    @for (option of options(); track option.value) {
      <button
        type="button"
        role="radio"
        [attr.aria-checked]="value() === option.value"
        [class.on]="value() === option.value"
        (click)="value.set(option.value)"
      >
        {{ option.label }}
      </button>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: grid;
      grid-template-columns: repeat(var(--count), 1fr);
      padding: 4px;
      background: var(--surface-2);
      border-radius: 999px;
      isolation: isolate;
    }
    .thumb {
      position: absolute;
      inset: 4px auto 4px 4px;
      width: calc((100% - 8px) / var(--count));
      transform: translateX(calc(var(--index) * 100%));
      background: var(--thumb);
      border-radius: 999px;
      box-shadow: var(--shadow);
      transition: transform 0.35s var(--spring);
      z-index: -1;
    }
    button {
      min-height: 40px;
      padding: 0.4rem 0.6rem;
      border: 0;
      background: transparent;
      color: var(--muted);
      white-space: nowrap;
      box-shadow: none !important;
      transition: color 0.2s var(--ease);
    }
    button.on {
      color: var(--text);
    }
  `,
})
export class Segmented<T extends string = string> {
  readonly options = input.required<SegmentOption<T>[]>();
  readonly label = input('');
  readonly value = model.required<T>();
  protected readonly index = computed(() => Math.max(0, this.options().findIndex((o) => o.value === this.value())));
}
