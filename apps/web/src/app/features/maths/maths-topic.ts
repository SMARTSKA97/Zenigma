import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { topicById, tricksOf } from '../../games/maths/maths-data';
import { MathsStore } from '../../games/maths/maths-store';

/** The tricks in one topic, with how many of their three levels you have got. */
@Component({
  selector: 'app-maths-topic',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './maths-topic.html',
  styleUrl: './maths.scss',
})
export class MathsTopic {
  protected readonly store = inject(MathsStore);
  private readonly id = toSignal(inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('topic') ?? '')), { initialValue: '' });
  protected readonly topic = computed(() => topicById(this.id()));
  protected readonly tricks = computed(() => tricksOf(this.id()));
  protected readonly dots = [1, 2, 3];
}
