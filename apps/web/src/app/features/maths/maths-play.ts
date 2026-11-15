import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { Level, LEVELS, MathsQuestion, topicById, TRICKS, trickById } from '../../games/maths/maths-data';
import { MASTERY, MathsStore } from '../../games/maths/maths-store';
import { DrillResult, MathsDrill } from './maths-drill';

/** One trick: a short lesson with a worked example, then a ten-question drill at the level you pick. Also the mixed drill. */
@Component({
  selector: 'app-maths-play',
  imports: [RouterLink, MathsDrill],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './maths-play.html',
  styleUrl: './maths.scss',
})
export class MathsPlay {
  protected readonly store = inject(MathsStore);
  protected readonly params = toSignal(inject(ActivatedRoute).paramMap.pipe(map((p) => ({ topic: p.get('topic') ?? '', trick: p.get('trick') ?? '' }))), { initialValue: { topic: '', trick: '' } });
  protected readonly mix = computed(() => this.params().topic === '');
  protected readonly trick = computed(() => trickById(this.params().trick));
  protected readonly topic = computed(() => topicById(this.params().topic));
  protected readonly ids = computed(() => (this.mix() ? TRICKS.map((t) => t.id) : this.trick() ? [this.trick()!.id] : []));
  protected readonly levels = LEVELS;
  protected readonly mastery = MASTERY;

  protected readonly stage = signal<'learn' | 'drill' | 'result'>('learn');
  protected readonly level = signal<Level>(1);
  protected readonly result = signal<DrillResult | null>(null);
  protected readonly newBest = signal(false);
  protected readonly example = computed<MathsQuestion | null>(() => this.trick()?.make(1, Math.random) ?? null);

  protected start(level: Level): void {
    this.level.set(level);
    this.result.set(null);
    this.stage.set('drill');
  }

  protected done(r: DrillResult): void {
    this.result.set(r);
    // The mixed drill has no single trick to score; its tricks keep their own records.
    const t = this.trick();
    this.newBest.set(t ? this.store.add(t.id, this.level(), r.correct, r.ms) : false);
    this.stage.set('result');
  }

  protected seconds(ms: number): string {
    return `${Math.round(ms / 1000)}s`;
  }

  protected verdict(correct: number): string {
    return correct === 10 ? 'Perfect!' : correct >= MASTERY ? 'Got it!' : correct >= 5 ? 'Getting there' : 'Keep going: the trick takes a few tries';
  }
}
