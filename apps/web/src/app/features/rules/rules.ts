import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { gameInfo } from '../../games/catalog';
import { Glyph } from '../../shared/glyph';
import { GAME_RULES } from './rules-data';

/** The rules hub: one card per game (each opens that game's full rules), plus how hints, Check and freezes work. */
@Component({
  selector: 'app-rules',
  imports: [RouterLink, Glyph],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="back" routerLink="/settings">‹ Settings</a>
    <h1>How to play</h1>
    <p class="muted lede">Pick a game for its full rules, a worked example and the techniques that solve it.</p>

    <div class="grid">
      @for (g of games; track g.id) {
        <a class="game" [routerLink]="['/rules', g.id]" [style.--h]="g.hue">
          <span class="art"><app-glyph [game]="$any(g.id)" /></span>
          <span class="txt">
            <b>{{ g.name }}</b>
            <span>{{ g.tagline }}</span>
          </span>
          <span class="go" aria-hidden="true">›</span>
        </a>
      }
    </div>

    <section class="card">
      <h2>Hints and Check</h2>
      <ul>
        <li>Hints work in Practice only, and one pool of hints is shared by every game.</li>
        <li>Tap Hint to light up the area worth looking at, with a short reason. If something you placed cannot be right, the hint shows the area it is in (orange). A hint never fills in the answer.</li>
        <li>Check is free. It only tells you whether the board has a mistake, not where.</li>
        <li>A hint costs 1. You start with 3. Spin the daily wheel on the Practice tab for 1 to 3 more, and earn one every 10th level. You can keep up to 10 from free sources.</li>
        <li>A level solved with a hint can still earn up to 2 stars.</li>
      </ul>
    </section>

    <section class="card">
      <h2>Streaks and freezes</h2>
      <ul>
        <li>Solve a game’s daily on consecutive days to build its streak.</li>
        <li>Play a game on 7 different days to earn one streak freeze for that game. Each game holds up to 2.</li>
        <li>A freeze covers one missed day for that game automatically. Tap the freezes chip on Home or Daily to see what each game has.</li>
      </ul>
    </section>
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
    h1 {
      margin: 0;
    }
    .lede {
      margin: 0.3rem 0 1rem;
    }
    .grid {
      display: grid;
      gap: 0.6rem;
      margin-bottom: 1.2rem;
    }
    .game {
      display: flex;
      align-items: center;
      gap: 0.8rem;
      padding: 0.7rem 0.9rem;
      border-radius: 18px;
      background: var(--surface);
      border: 1px solid var(--border);
      color: var(--text);
      text-decoration: none;
    }
    .art {
      display: grid;
      place-items: center;
      flex: none;
      width: 3rem;
      height: 3rem;
      border-radius: 14px;
      background: oklch(0.92 0.06 calc(var(--h) * 1deg));
    }
    .art :is(svg) {
      width: 70%;
      height: 70%;
    }
    .txt {
      display: grid;
      flex: 1;
      gap: 0.1rem;
    }
    .txt span {
      color: var(--muted);
      font-size: 0.85rem;
    }
    .go {
      font-size: 1.4rem;
      color: var(--muted);
    }
    .card {
      margin-bottom: 1rem;
    }
    h2 {
      margin: 0 0 0.5rem;
      font-size: 1.1rem;
    }
    ul {
      margin: 0;
      padding-left: 1.2rem;
      display: grid;
      gap: 0.4rem;
      line-height: 1.5;
    }
  `,
})
export class Rules {
  protected readonly games = GAME_RULES.map((g) => ({ ...g, hue: gameInfo(g.id)?.hue ?? 160 }));
}
