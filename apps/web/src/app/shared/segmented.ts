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
  templateUrl: './segmented.html',
  styleUrl: './segmented.scss',
})
export class Segmented<T extends string = string> {
  readonly options = input.required<SegmentOption<T>[]>();
  readonly label = input('');
  readonly value = model.required<T>();
  protected readonly index = computed(() => Math.max(0, this.options().findIndex((o) => o.value === this.value())));
}
