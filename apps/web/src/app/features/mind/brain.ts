import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { Skill, SKILLS } from '../../games/catalog';

/** Where each skill sits on the drawing. A simplified map for fun, not a medical one. */
export const BRAIN_REGIONS: Record<Skill, string> = {
  logic: 'Frontal lobe',
  math: 'Parietal lobe',
  language: 'Temporal lobe',
  speed: 'Occipital lobe and cerebellum',
  memory: 'Hippocampus',
  attention: 'Cingulate cortex',
};

/** A side view of the brain, each part tinted by how strong the matching skill is (0 to 100). Tap a part to pick a skill. */
@Component({
  selector: 'app-brain',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './brain.html',
  styleUrl: './brain.scss',
})
export class Brain {
  /** Mark (0 to 100) per skill. */
  readonly marks = input.required<Record<Skill, number>>();
  readonly selected = model<Skill | null>(null);
  protected readonly skills = SKILLS;
  protected readonly regions = BRAIN_REGIONS;

  protected readonly tint = computed(() => {
    const out = {} as Record<Skill, string>;
    for (const s of SKILLS) {
      const mark = Math.max(0, Math.min(100, this.marks()[s.id] ?? 0));
      out[s.id] = `color-mix(in srgb, var(--accent) ${Math.round(12 + mark * 0.78)}%, var(--surface-2))`;
    }
    return out;
  });

  protected pick(skill: Skill): void {
    this.selected.set(this.selected() === skill ? null : skill);
  }
}
