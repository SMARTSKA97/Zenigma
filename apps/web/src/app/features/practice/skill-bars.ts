import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { SKILLS } from '../../games/catalog';
import { MindStore } from '../../games/mind/mind-store';

/** Your mark in each trained skill (0 to 100), from your best scores. Skills you have not tried read zero. */
@Component({
  selector: 'app-skill-bars',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './skill-bars.html',
  styleUrl: './skill-bars.scss',
})
export class SkillBars {
  protected readonly store = inject(MindStore);
  protected readonly rows = computed(() => SKILLS.map((s) => ({ ...s, mark: this.store.skills().find((x) => x.skill === s.id)?.mark ?? 0 })));
}
