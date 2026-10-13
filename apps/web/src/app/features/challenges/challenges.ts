import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HintsService } from '../../core/hints.service';
import { ChallengeState, PERIOD_NAMES, Period, timeLeft } from './challenge-engine';
import { ChallengesService } from './challenges.service';

const ORDER: Period[] = ['weekly', 'weekend', 'monthly'];

/** A short summary of the three challenge periods. Tap it to open all the goals. Used on Home, Daily and Practice. */
@Component({
  selector: 'app-challenge-strip',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="strip" routerLink="/challenges" aria-label="Challenges: weekly, weekend and monthly">
      <span class="head">
        <b>Challenges</b>
        @if (c.toCollect(); as n) {
          <span class="pill">{{ n }} to collect</span>
        } @else {
          <span class="muted">Earn hints</span>
        }
        <span class="go" aria-hidden="true">›</span>
      </span>
      <span class="rows">
        @for (p of order; track p) {
          @let items = c.sets()[p];
          <span class="row" [class.closed]="!items[0]?.window.open">
            <span class="name">{{ names[p] }}</span>
            <span class="dots" aria-hidden="true">
              @for (i of items; track i.claimKey) {
                <i [class.on]="i.done" [style.--p]="progress(i)"></i>
              }
            </span>
            <span class="num">{{ !items[0]?.window.open ? 'Sat' : done(items) + '/' + items.length }}</span>
          </span>
        }
      </span>
    </a>
  `,
  styles: `
    :host {
      display: block;
    }
    .strip {
      display: grid;
      gap: 0.6rem;
      padding: 0.9rem 1rem;
      border-radius: var(--radius);
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text);
      text-decoration: none;
    }
    .head {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }
    .head .go {
      margin-left: auto;
      color: var(--muted);
      font-size: 1.3rem;
    }
    .pill {
      padding: 0.1rem 0.55rem;
      border-radius: 999px;
      background: var(--accent);
      color: var(--accent-contrast, #fff);
      font-size: 0.75rem;
      font-weight: 700;
    }
    .rows {
      display: grid;
      gap: 0.4rem;
    }
    .row {
      display: grid;
      grid-template-columns: 6.5rem 1fr auto;
      align-items: center;
      gap: 0.6rem;
      font-size: 0.85rem;
    }
    .row.closed {
      opacity: 0.6;
    }
    .dots {
      display: flex;
      gap: 0.3rem;
    }
    .dots i {
      flex: 1;
      height: 6px;
      border-radius: 99px;
      background: linear-gradient(90deg, var(--accent) calc(var(--p) * 1%), var(--surface-2) 0);
    }
    .dots i.on {
      background: var(--good, #2e9e5b);
    }
    .num {
      font-variant-numeric: tabular-nums;
      font-weight: 650;
      min-width: 2rem;
      text-align: right;
    }
  `,
})
export class ChallengeStrip implements OnInit {
  protected readonly c = inject(ChallengesService);
  protected readonly order = ORDER;
  protected readonly names = PERIOD_NAMES;

  ngOnInit(): void {
    void this.c.load();
  }

  protected progress(s: ChallengeState): number {
    return Math.min(100, Math.round((s.have / s.template.target) * 100));
  }

  protected done(items: ChallengeState[]): number {
    return items.filter((i) => i.done).length;
  }
}

/** All weekly, weekend and monthly goals, with progress and the hints they earn. */
@Component({
  selector: 'app-challenges',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="back" routerLink="/daily">‹ Daily</a>
    <h1>Challenges</h1>
    <p class="muted lede">Goals that change every week, weekend and month. Finish one to earn hints for practice. Progress is counted on this device{{ signedIn() ? '' : ' (sign in to include your dailies)' }}.</p>
    <p class="hint-line"><span aria-hidden="true">💡</span> You have <b>{{ hints.balance() }}</b> {{ hints.balance() === 1 ? 'hint' : 'hints' }}</p>

    @if (message(); as m) {
      <p class="toast" role="status">{{ m }}</p>
    }

    @for (p of order; track p) {
      @let items = c.sets()[p];
      <section class="period">
        <header>
          <h2>{{ names[p] }}</h2>
          <span class="muted">{{ left(items) }}</span>
        </header>
        @for (s of items; track s.claimKey) {
          <article class="goal" [class.done]="s.done" [class.closed]="!s.window.open">
            <span class="icon" aria-hidden="true">{{ s.template.icon }}</span>
            <div class="body">
              <b>{{ s.template.title }}</b>
              <span class="text">{{ s.template.text }}</span>
              <span class="bar" role="progressbar" [attr.aria-valuenow]="min(s)" aria-valuemin="0" [attr.aria-valuemax]="s.template.target">
                <i [style.width.%]="(min(s) / s.template.target) * 100"></i>
              </span>
            </div>
            <div class="end">
              @if (c.isClaimed(s)) {
                <span class="got">Collected</span>
              } @else if (s.done) {
                <button type="button" class="collect" (click)="collect(s)">+{{ s.template.reward }} 💡</button>
              } @else {
                <span class="num">{{ min(s) }}/{{ s.template.target }}</span>
                <span class="reward">+{{ s.template.reward }} 💡</span>
              }
            </div>
          </article>
        }
      </section>
    }
    <p class="muted foot">Hints never touch dailies or leaderboards. You can hold up to 10 from free sources.</p>
  `,
  styles: `
    :host {
      display: block;
      max-width: 40rem;
      margin: 0 auto;
      padding: 0 0 6rem;
    }
    .back {
      display: inline-block;
      margin: 0.4rem 0;
      color: var(--muted);
      text-decoration: none;
      font-weight: 600;
    }
    h1 {
      margin: 0;
    }
    .lede {
      margin: 0.3rem 0 0.8rem;
    }
    .hint-line {
      margin: 0 0 1rem;
    }
    .toast {
      padding: 0.6rem 0.9rem;
      border-radius: 14px;
      background: var(--accent-soft);
      font-weight: 600;
    }
    .period {
      margin-bottom: 1.4rem;
      display: grid;
      gap: 0.6rem;
    }
    .period header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
    }
    .period h2 {
      margin: 0;
      font-size: 1.15rem;
    }
    .goal {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 0.8rem;
      padding: 0.85rem 1rem;
      border-radius: 20px;
      border: 1px solid var(--border);
      background: var(--surface);
    }
    .goal.done {
      border-color: color-mix(in srgb, var(--good, #2e9e5b) 55%, var(--border));
      background: color-mix(in srgb, var(--good, #2e9e5b) 8%, var(--surface));
    }
    .goal.closed {
      opacity: 0.65;
    }
    .icon {
      font-size: 1.8rem;
    }
    .body {
      display: grid;
      gap: 0.2rem;
      min-width: 0;
    }
    .text {
      color: var(--muted);
      font-size: 0.82rem;
    }
    .bar {
      height: 6px;
      border-radius: 99px;
      background: var(--surface-2);
      overflow: hidden;
      margin-top: 0.2rem;
    }
    .bar i {
      display: block;
      height: 100%;
      border-radius: 99px;
      background: var(--accent);
    }
    .goal.done .bar i {
      background: var(--good, #2e9e5b);
    }
    .end {
      display: grid;
      justify-items: end;
      gap: 0.15rem;
      font-size: 0.8rem;
    }
    .num {
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .reward,
    .got {
      color: var(--muted);
    }
    :host .collect {
      min-height: 0;
      padding: 0.45rem 0.8rem;
      border-radius: 999px;
      font-weight: 700;
    }
    .foot {
      font-size: 0.8rem;
    }
  `,
})
export class ChallengesPage implements OnInit {
  protected readonly c = inject(ChallengesService);
  protected readonly hints = inject(HintsService);
  protected readonly order = ORDER;
  protected readonly names = PERIOD_NAMES;
  protected readonly message = signal('');
  protected readonly signedIn = computed(() => this.c.stats() !== null);

  ngOnInit(): void {
    void this.c.load();
  }

  protected min(s: ChallengeState): number {
    return Math.min(s.have, s.template.target);
  }

  protected left(items: ChallengeState[]): string {
    const w = items[0]?.window;
    if (!w) return '';
    const t = timeLeft(w, this.c.now());
    return w.open ? `${t} left` : `Starts Saturday, in ${t}`;
  }

  protected collect(s: ChallengeState): void {
    const added = this.c.claim(s);
    this.message.set(added > 0 ? `+${added} ${added === 1 ? 'hint' : 'hints'} collected` : 'Collected. Your hint stash is full, so spend a few first.');
    setTimeout(() => this.message.set(''), 3000);
  }
}
