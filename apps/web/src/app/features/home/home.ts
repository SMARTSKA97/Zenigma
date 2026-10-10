import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface GamePlan {
  name: string;
  blurb: string;
  phase: number;
  route?: string;
}

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  template: `
    <h1>Daily puzzles and endless levels</h1>
    <p class="muted">
      Zenigma works offline and syncs when you are online. The games arrive phase by phase; the foundation below is what
      every game will build on.
    </p>
    <div class="grid">
      @for (game of games; track game.name) {
        @if (game.route) {
          <a class="card game-card live" [routerLink]="game.route">
            <h3>{{ game.name }}</h3>
            <p class="muted">{{ game.blurb }}</p>
            <span class="phase">Play</span>
          </a>
        } @else {
          <div class="card game-card">
            <h3>{{ game.name }}</h3>
            <p class="muted">{{ game.blurb }}</p>
            <span class="phase">Phase {{ game.phase }}</span>
          </div>
        }
      }
    </div>
  `,
  styles: `
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
      gap: 1rem;
      margin-top: 1.5rem;
    }
    .phase {
      font-size: 0.8rem;
      color: var(--accent);
    }
    p {
      margin: 0 0 0.75rem;
    }
    .game-card {
      display: block;
      color: inherit;
      text-decoration: none;
    }
    .game-card:not(.live) {
      opacity: 0.65;
    }
    .live {
      transition:
        transform 0.2s var(--ease),
        border-color 0.2s var(--ease);
    }
    .live:hover {
      transform: translateY(-2px);
      border-color: var(--accent);
    }
    .live:active {
      transform: scale(0.98);
    }
  `,
})
export class Home {
  protected readonly games: GamePlan[] = [
    { name: 'Word Guess', blurb: 'Guess the five-letter word in six tries.', phase: 2, route: '/games/word-guess' },
    { name: 'Queens', blurb: 'One queen per row, column and colour region.', phase: 3 },
    { name: 'Tango', blurb: 'Fill the grid with two symbols, no three in a row.', phase: 3 },
    { name: 'Mini Sudoku', blurb: 'A 6x6 Sudoku with 2x3 boxes.', phase: 3 },
    { name: 'Zip', blurb: 'Draw one path through every cell, numbers in order.', phase: 4 },
    { name: 'Patches', blurb: 'Split the grid into rectangles that match the clues.', phase: 4 },
    { name: 'Pinpoint', blurb: 'Name the category from up to five clues.', phase: 4 },
    { name: 'Crossclimb', blurb: 'Climb a word ladder, one letter at a time.', phase: 4 },
    { name: 'Wend', blurb: 'Find four hidden words that use every letter.', phase: 4 },
    { name: 'Comet Slice', blurb: 'Slice the comets, avoid the bombs, keep your lives.', phase: 5 },
  ];
}
