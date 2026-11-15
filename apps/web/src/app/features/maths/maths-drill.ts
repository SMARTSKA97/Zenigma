import { ChangeDetectionStrategy, Component, HostListener, inject, input, OnInit, output, signal } from '@angular/core';
import { HapticsService } from '../../core/haptics.service';
import { Level, MathsQuestion, Rand, TRICKS, trickById } from '../../games/maths/maths-data';

export interface DrillResult {
  correct: number;
  total: number;
  ms: number;
}

const COUNT = 10;

/** Ten questions on one trick (or a mix), answered on a number pad. A wrong answer shows how the trick gets there. */
@Component({
  selector: 'app-maths-drill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './maths-drill.html',
  styleUrl: './maths-drill.scss',
})
export class MathsDrill implements OnInit {
  readonly tricks = input.required<string[]>();
  readonly level = input.required<Level>();
  readonly finished = output<DrillResult>();

  private readonly haptics = inject(HapticsService);
  protected readonly total = COUNT;
  protected readonly index = signal(0);
  protected readonly correct = signal(0);
  protected readonly typed = signal('');
  protected readonly q = signal<MathsQuestion | null>(null);
  protected readonly trickName = signal('');
  /** After an answer: whether it was right. Null while the question is open. */
  protected readonly verdict = signal<boolean | null>(null);
  protected readonly pad = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  private started = 0;
  private readonly rnd: Rand = Math.random;
  private last = '';

  ngOnInit(): void {
    this.started = Date.now();
    this.next();
  }

  protected press(d: number): void {
    if (this.verdict() !== null || this.typed().length >= 8) return;
    this.haptics.tick();
    this.typed.update((t) => (t === '0' ? String(d) : t + d));
  }

  protected back(): void {
    if (this.verdict() === null) this.typed.update((t) => t.slice(0, -1));
  }

  protected submit(value?: number): void {
    const q = this.q();
    if (!q || this.verdict() !== null) return;
    const given = value ?? (this.typed() === '' ? NaN : Number(this.typed()));
    if (Number.isNaN(given)) return;
    const ok = given === q.answer;
    this.verdict.set(ok);
    if (ok) {
      this.correct.update((c) => c + 1);
      this.haptics.success();
    } else {
      this.haptics.error();
    }
  }

  protected advance(): void {
    if (this.verdict() === null) return;
    if (this.index() + 1 >= COUNT) {
      this.finished.emit({ correct: this.correct(), total: COUNT, ms: Date.now() - this.started });
      return;
    }
    this.index.update((i) => i + 1);
    this.next();
  }

  private next(): void {
    const pool = this.tricks().map((id) => trickById(id)).filter((t) => !!t);
    const list = pool.length ? pool : TRICKS;
    let q: MathsQuestion;
    let name: string;
    let tries = 0;
    do {
      const trick = list[Math.floor(this.rnd() * list.length)]!;
      q = trick.make(this.level(), this.rnd);
      name = trick.name;
      tries++;
    } while (q.text === this.last && tries < 5);
    this.last = q.text;
    this.q.set(q);
    this.trickName.set(this.tricks().length > 1 ? name : '');
    this.typed.set('');
    this.verdict.set(null);
  }

  @HostListener('window:keydown', ['$event'])
  protected key(e: KeyboardEvent): void {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^[0-9]$/.test(e.key)) this.press(Number(e.key));
    else if (e.key === 'Backspace') this.back();
    else if (e.key === 'Enter') {
      if (this.verdict() === null) this.submit();
      else this.advance();
    }
  }
}
