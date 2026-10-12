import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { Glyph, GameId } from '../../shared/glyph';

interface GamePlan {
  id: GameId;
  name: string;
  blurb: string;
  hue: number;
  route?: string;
}

@Component({
  selector: 'app-home',
  imports: [RouterLink, Glyph],
  template: `
    <section class="hero">
      <div class="copy">
        <h1>{{ greeting() }}</h1>
        <p class="lede">Your puzzles for today. Offline works too; everything syncs when you are back online.</p>
        <a class="button play" routerLink="/games/word-guess">Play Word Guess</a>
      </div>
      <div class="preview" aria-hidden="true">
        @for (tile of preview; track $index) {
          <span class="tile" [attr.data-mark]="tile.mark" [style.--i]="$index">{{ tile.letter }}</span>
        }
      </div>
    </section>

    <h2 class="section">All games</h2>
    <div class="grid">
      @for (game of games; track game.id) {
        @if (game.route) {
          <a class="game live" [routerLink]="game.route" [style.--h]="game.hue">
            <span class="art"><app-glyph [game]="game.id" /></span>
            <span class="name">{{ game.name }}</span>
            <span class="blurb">{{ game.blurb }}</span>
            <span class="tag play-tag">Play</span>
          </a>
        } @else {
          <div class="game" [style.--h]="game.hue">
            <span class="art"><app-glyph [game]="game.id" /></span>
            <span class="name">{{ game.name }}</span>
            <span class="blurb">{{ game.blurb }}</span>
            <span class="tag">Coming soon</span>
          </div>
        }
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .hero {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      gap: 2rem;
      padding: clamp(1.5rem, 4vw, 2.75rem);
      border-radius: 28px;
      background: var(--ink);
      color: var(--ink-contrast);
      overflow: hidden;
    }
    .hero h1 {
      margin-bottom: 0.6rem;
    }
    .lede {
      max-width: 30ch;
      margin-bottom: 1.5rem;
      opacity: 0.72;
    }
    .play {
      background: var(--ink-contrast);
      color: var(--ink);
      border-color: var(--ink-contrast);
    }

    .preview {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 0.4rem;
      width: min(100%, 19rem);
    }
    .tile {
      aspect-ratio: 1;
      display: grid;
      place-items: center;
      border-radius: 12px;
      font-family: var(--font-display);
      font-weight: 700;
      font-size: clamp(1.1rem, 4vw, 1.6rem);
      color: #fff;
      background: color-mix(in srgb, var(--ink-contrast) 14%, transparent);
      animation: reveal 0.6s var(--ease) backwards;
      animation-delay: calc(0.35s + var(--i) * 0.16s);
    }
    .tile[data-mark='correct'] {
      background: var(--mark-correct);
    }
    .tile[data-mark='present'] {
      background: var(--mark-present);
    }
    .tile[data-mark='absent'] {
      background: color-mix(in srgb, var(--ink-contrast) 22%, transparent);
    }
    @keyframes reveal {
      0% {
        transform: rotateX(90deg);
        background: color-mix(in srgb, var(--ink-contrast) 14%, transparent);
      }
    }

    .section {
      margin: 2.5rem 0 1rem;
      font-size: 1.1rem;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
      gap: 0.9rem;
    }
    .game {
      position: relative;
      display: grid;
      grid-template-columns: auto 1fr;
      grid-template-areas:
        'art name'
        'art blurb'
        'tag tag';
      column-gap: 1rem;
      row-gap: 0.1rem;
      align-items: center;
      align-content: start;
      padding: 1rem;
      color: inherit;
      text-decoration: none;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      transition:
        transform 0.25s var(--ease),
        box-shadow 0.25s var(--ease),
        border-color 0.25s var(--ease);
    }
    .art {
      grid-area: art;
      width: 3.5rem;
      height: 3.5rem;
      padding: 0.6rem;
      border-radius: 16px;
      background: oklch(var(--tile-l) var(--tile-c) calc(var(--h) * 1deg));
      color: oklch(var(--glyph-l) var(--glyph-c) calc(var(--h) * 1deg));
    }
    .name {
      grid-area: name;
      align-self: end;
      font-family: var(--font-display);
      font-weight: 650;
      font-size: 1.05rem;
      letter-spacing: -0.01em;
    }
    .blurb {
      grid-area: blurb;
      align-self: start;
      color: var(--muted);
      font-size: 0.85rem;
      line-height: 1.35;
    }
    .tag {
      grid-area: tag;
      margin-top: 0.75rem;
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--muted);
    }
    .game:not(.live) .art {
      opacity: 0.6;
    }
    .live .play-tag {
      color: var(--accent);
    }
    .live:hover {
      transform: translateY(-3px);
      box-shadow: var(--shadow-lift);
      border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
    }
    .live:active {
      transform: scale(0.985);
    }

    @media (max-width: 720px) {
      .hero {
        grid-template-columns: 1fr;
        gap: 1.5rem;
        border-radius: 24px;
      }
      .preview {
        order: -1;
        width: min(100%, 15rem);
      }
      .grid {
        grid-template-columns: 1fr 1fr;
        gap: 0.65rem;
      }
      .game {
        grid-template-columns: 1fr;
        grid-template-areas: 'art' 'name' 'blurb' 'tag';
        padding: 0.9rem;
        row-gap: 0.15rem;
      }
      .art {
        margin-bottom: 0.6rem;
      }
      .blurb {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
    }
    @media (max-width: 380px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class Home {
  private readonly auth = inject(AuthService);

  protected readonly greeting = computed(() => {
    const hour = new Date().getHours();
    const part = hour < 5 ? 'Still up' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const name = this.auth.user()?.displayName?.trim().split(' ')[0];
    return name ? `${part}, ${name}` : part;
  });

  protected readonly preview = [
    { letter: 'S', mark: 'absent' },
    { letter: 'O', mark: 'present' },
    { letter: 'L', mark: 'correct' },
    { letter: 'V', mark: 'absent' },
    { letter: 'E', mark: 'correct' },
  ];

  protected readonly games: GamePlan[] = [
    { id: 'word-guess', name: 'Word Guess', blurb: 'Five letters, six tries.', hue: 160, route: '/games/word-guess' },
    { id: 'queens', name: 'Queens', blurb: 'One queen per row, column and colour.', hue: 330 },
    { id: 'tango', name: 'Tango', blurb: 'Two symbols, never three in a row.', hue: 55 },
    { id: 'mini-sudoku', name: 'Mini Sudoku', blurb: 'A 6 by 6 grid with 2 by 3 boxes.', hue: 250 },
    { id: 'zip', name: 'Zip', blurb: 'One path through every cell, in order.', hue: 25 },
    { id: 'patches', name: 'Patches', blurb: 'Split the grid into matching rectangles.', hue: 300 },
    { id: 'pinpoint', name: 'Pinpoint', blurb: 'Name the category from up to five clues.', hue: 200 },
    { id: 'crossclimb', name: 'Crossclimb', blurb: 'Climb a word ladder, one letter at a time.', hue: 95 },
    { id: 'wend', name: 'Wend', blurb: 'Four hidden words that use every letter.', hue: 275 },
    { id: 'comet-slice', name: 'Comet Slice', blurb: 'Slice comets, dodge bombs, keep your lives.', hue: 15 },
  ];
}
