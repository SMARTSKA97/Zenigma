import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { gameInfo, isPuzzleGame } from '../../games/catalog';
import { Glyph } from '../../shared/glyph';
import { RuleFigure } from './rule-figure';
import { GAME_RULES, RULES_BY_ID } from './rules-data';

/** In-depth rules for one game: goal, rules, a worked example, techniques, mistakes and tips. */
@Component({
  selector: 'app-rule-page',
  imports: [RouterLink, RuleFigure, Glyph],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="back" routerLink="/rules">‹ All rules</a>
    @if (rules(); as r) {
      <header class="head" [style.--h]="hue()">
        <span class="art"><app-glyph [game]="$any(r.id)" /></span>
        <div>
          <h1>{{ r.name }}</h1>
          <p class="goal">{{ r.goal }}</p>
        </div>
      </header>

      <nav class="jump" aria-label="On this page">
        <a [routerLink]="[]" fragment="rules">Rules</a>
        <a [routerLink]="[]" fragment="example">Example</a>
        <a [routerLink]="[]" fragment="techniques">Techniques</a>
        <a [routerLink]="[]" fragment="tips">Tips</a>
      </nav>

      <section class="card" id="rules">
        <h2>The rules</h2>
        <ol>
          @for (line of r.rules; track line) {
            <li>{{ line }}</li>
          }
        </ol>
        @if (r.modes) {
          <p class="muted modes">{{ r.modes }}</p>
        }
      </section>

      <section class="card" id="example">
        <h2>Worked example</h2>
        <p class="sub">{{ r.example.title }}</p>
        <ol class="steps">
          @for (step of r.example.steps; track $index) {
            <li>
              <p>{{ step.text }}</p>
              @if (step.figure) {
                <app-rule-figure [figure]="step.figure" />
              }
            </li>
          }
        </ol>
      </section>

      <section class="card" id="techniques">
        <h2>Techniques</h2>
        @for (t of r.techniques; track t.title) {
          <article>
            <h3>{{ t.title }}</h3>
            <p>{{ t.text }}</p>
            @if (t.figure) {
              <app-rule-figure [figure]="t.figure" />
            }
          </article>
        }
      </section>

      <section class="card" id="tips">
        <h2>Common mistakes</h2>
        <ul>
          @for (m of r.mistakes; track m) {
            <li>{{ m }}</li>
          }
        </ul>
        <h2 class="gap">Tips</h2>
        <ul>
          @for (t of r.tips; track t) {
            <li>{{ t }}</li>
          }
        </ul>
      </section>

      <div class="cta">
        <a class="button" [routerLink]="playLink()">Play {{ r.name }}</a>
        @if (nextGame(); as n) {
          <a class="button secondary" [routerLink]="['/rules', n.id]">Next: {{ n.name }} ›</a>
        }
      </div>
    } @else {
      <section class="card">
        <h1>Rules not found</h1>
        <p class="muted">There is no rules page for this game.</p>
        <a class="button" routerLink="/rules">All rules</a>
      </section>
    }
  `,
  styles: `
    :host {
      display: block;
      max-width: 40rem;
      margin: 0 auto;
      padding: 0 1rem 7rem;
    }
    .back {
      display: inline-block;
      margin: 0.6rem 0;
      color: var(--muted);
      text-decoration: none;
    }
    .head {
      display: flex;
      align-items: center;
      gap: 0.9rem;
      margin-bottom: 0.8rem;
    }
    .art {
      display: grid;
      place-items: center;
      flex: none;
      width: 4rem;
      height: 4rem;
      border-radius: 18px;
      background: oklch(0.92 0.06 calc(var(--h) * 1deg));
    }
    .art :is(svg) {
      width: 70%;
      height: 70%;
    }
    h1 {
      margin: 0;
      font-size: 1.6rem;
    }
    .goal {
      margin: 0.2rem 0 0;
      color: var(--muted);
    }
    .jump {
      display: flex;
      gap: 0.4rem;
      overflow-x: auto;
      padding-bottom: 0.4rem;
      margin-bottom: 0.8rem;
    }
    .jump a {
      flex: none;
      padding: 0.35rem 0.8rem;
      border-radius: 999px;
      background: var(--surface-2);
      color: var(--text);
      text-decoration: none;
      font-size: 0.9rem;
    }
    .card {
      margin-bottom: 1rem;
      scroll-margin-top: 1rem;
    }
    h2 {
      margin: 0 0 0.5rem;
      font-size: 1.1rem;
    }
    h2.gap {
      margin-top: 1.1rem;
    }
    h3 {
      margin: 0.9rem 0 0.2rem;
      font-size: 0.98rem;
    }
    p {
      margin: 0.25rem 0;
      line-height: 1.5;
    }
    .sub {
      font-weight: 650;
    }
    ol,
    ul {
      margin: 0;
      padding-left: 1.2rem;
      display: grid;
      gap: 0.4rem;
      line-height: 1.5;
    }
    .steps {
      gap: 0.8rem;
    }
    .modes {
      margin-top: 0.8rem;
      font-size: 0.88rem;
    }
    .cta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
  `,
})
export class RulePage {
  private readonly route = inject(ActivatedRoute);
  private readonly id = toSignal(this.route.paramMap.pipe(map((p) => p.get('game') ?? '')), { initialValue: '' });

  protected readonly rules = computed(() => RULES_BY_ID.get(this.id()) ?? null);
  protected readonly hue = computed(() => gameInfo(this.id())?.hue ?? 160);
  protected readonly playLink = computed(() => (this.id() === 'word-guess' ? '/games/word-guess' : isPuzzleGame(this.id()) ? ['/games', this.id()] : '/practice'));
  protected readonly nextGame = computed(() => {
    const i = GAME_RULES.findIndex((g) => g.id === this.id());
    return i >= 0 && i < GAME_RULES.length - 1 ? GAME_RULES[i + 1] : null;
  });
}
