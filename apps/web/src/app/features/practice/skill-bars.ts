import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { SKILLS } from '../../games/catalog';
import { MindStore } from '../../games/mind/mind-store';

/** Your mark in each trained skill (0 to 100), from your best scores. Skills you have not tried read zero. */
@Component({
  selector: 'app-skill-bars',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="skills" aria-label="Your skills">
      @for (s of rows(); track s.id) {
        <div class="row">
          <span class="name">{{ s.emoji }} {{ s.name }}</span>
          <span class="bar" role="progressbar" [attr.aria-valuenow]="s.mark" aria-valuemin="0" aria-valuemax="100"><i [style.width.%]="s.mark"></i></span>
          <span class="num">{{ s.mark }}</span>
        </div>
      }
      <p class="muted note">Each mark is the average of your best scores in that skill's games. {{ store.totalPlays() }} {{ store.totalPlays() === 1 ? 'game' : 'games' }} played.</p>
    </section>
  `,
  styles: `
    .skills {
      display: grid;
      gap: 0.5rem;
      padding: 0.9rem 1rem;
      margin-bottom: 0.9rem;
      border-radius: var(--radius);
      border: 1px solid var(--border);
      background: var(--surface);
    }
    .row {
      display: grid;
      grid-template-columns: 6.5rem 1fr 2rem;
      align-items: center;
      gap: 0.6rem;
      font-size: 0.85rem;
    }
    .bar {
      height: 8px;
      border-radius: 99px;
      background: var(--surface-2);
      overflow: hidden;
    }
    .bar i {
      display: block;
      height: 100%;
      border-radius: 99px;
      background: var(--accent);
      transition: width 0.6s var(--ease);
    }
    .num {
      text-align: right;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .note {
      margin: 0.2rem 0 0;
      font-size: 0.75rem;
    }
  `,
})
export class SkillBars {
  protected readonly store = inject(MindStore);
  protected readonly rows = computed(() => SKILLS.map((s) => ({ ...s, mark: this.store.skills().find((x) => x.skill === s.id)?.mark ?? 0 })));
}
