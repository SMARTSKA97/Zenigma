import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TOPICS, tricksOf } from '../../games/maths/maths-data';
import { MathsStore } from '../../games/maths/maths-store';
import { PracticeTabs } from '../../shared/practice-tabs';

/** Maths practice: the topics, a mixed drill, and how many tricks you have got. */
@Component({
  selector: 'app-maths-home',
  imports: [RouterLink, PracticeTabs],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './maths-home.html',
  styleUrl: './maths.scss',
})
export class MathsHome {
  protected readonly store = inject(MathsStore);
  protected readonly topics = TOPICS.map((t) => ({ ...t, tricks: tricksOf(t.id).length }));
}
