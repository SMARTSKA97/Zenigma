import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

/** A tiny picture of a board. Cells starting with "+" are highlighted as good, "!" as wrong, "." is empty. */
interface Figure {
  rows: string[][];
  caption: string;
}

interface Rule {
  id: string;
  name: string;
  goal: string;
  rules: string[];
  figures: Figure[];
  tips: string[];
}

const RULES: Rule[] = [
  {
    id: 'word-guess',
    name: 'Word Guess',
    goal: 'Find the hidden five-letter word in six guesses.',
    rules: [
      'Every guess must be a real five-letter word.',
      'After each guess every letter is coloured: green means right letter, right place; yellow means the letter is in the word but somewhere else; grey means it is not in the word (or you already used up all its copies).',
      'Repeated letters are counted: if the word has one E and you guess two, only one of them can be green or yellow.',
    ],
    figures: [
      { rows: [['+C', '?R', '.A', '.N', '.E']], caption: 'C is green (right spot). R is yellow (in the word, wrong spot). A, N and E are grey.' },
    ],
    tips: ['Open with a word that has common, different letters.', 'Use the keyboard colours to avoid wasting guesses on letters you have ruled out.'],
  },
  {
    id: 'queens',
    name: 'Queens',
    goal: 'Put one queen in every row, every column and every coloured region.',
    rules: [
      'Exactly one queen per row, per column and per colour region.',
      'No two queens may touch, not even diagonally.',
      'Tap once to mark ✕ (a queen cannot go here), tap again to place a queen, tap a third time to clear.',
    ],
    figures: [
      { rows: [['♛', '.', '.', '.'], ['.', '.', '!♛', '.'], ['.', '.', '.', '.'], ['.', '.', '.', '.']], caption: 'Wrong: the two queens touch diagonally, so they would conflict.' },
      { rows: [['.', '+♛', '.', '.'], ['.', '.', '.', '+♛'], ['+♛', '.', '.', '.'], ['.', '.', '+♛', '.']], caption: 'Right: one per row and column, and none touching.' },
    ],
    tips: ['Look for a colour region that fits in a single row or column: its queen is in that line, so cross out the rest of the line.', 'Small regions are the best place to start.'],
  },
  {
    id: 'tango',
    name: 'Tango',
    goal: 'Fill the grid with suns and moons.',
    rules: [
      'Every row and every column holds the same number of suns and moons.',
      'No more than two of the same symbol may sit next to each other, in a row or a column.',
      '= between two cells means they are the same; × means they are different.',
    ],
    figures: [
      { rows: [['☀', '☀', '!☀', '☾']], caption: 'Wrong: three suns in a row.' },
      { rows: [['☀', '+=', '☀', '☾'], ['☾', '+×', '☀', '☀']], caption: 'A = clue forces equal neighbours; a × clue forces different ones.' },
    ],
    tips: ['If two suns are already side by side, the cells on both ends must be moons.', 'Count each line: once it has all its suns, the rest are moons.'],
  },
  {
    id: 'sudoku',
    name: 'Sudoku',
    goal: 'Fill every cell with a number so nothing repeats.',
    rules: [
      'Classic is 9×9 with the numbers 1–9. Mini is 6×6 with 1–6, in 2×3 boxes.',
      'Every row, every column and every box contains each number exactly once.',
      'Every puzzle has exactly one solution, so you never need to guess.',
    ],
    figures: [
      { rows: [['1', '2', '3'], ['.', '.', '.'], ['.', '.', '!1']], caption: 'Wrong: the 1 in the last cell repeats the 1 in its column (top-left).' },
      { rows: [['1', '2', '+3'], ['2', '3', '1'], ['3', '1', '2']], caption: 'A tiny 3×3 version: every line has 1, 2 and 3 once. The missing 3 in the top row is forced.' },
    ],
    tips: ['Scan for a number that fits in only one cell of a box, row or column.', 'Use pencil notes to track candidates when no cell is obvious.'],
  },
  {
    id: 'zip',
    name: 'Zip',
    goal: 'Draw one path through every cell that visits the numbers in order.',
    rules: [
      'Start at 1 and end at the highest number.',
      'The path moves up, down, left or right and passes through every cell exactly once.',
      'Numbers must be reached in order: 1, then 2, then 3 and so on.',
    ],
    figures: [
      { rows: [['+1', '→', '→'], ['→', '→', '↓'], ['+3', '←', '+2']], caption: 'A path that touches every cell and visits 1, 2, 3 in order is a solution.' },
    ],
    tips: ['Work backwards from the last number too.', 'A corner cell has only two neighbours, so its path is often forced.'],
  },
  {
    id: 'patches',
    name: 'Patches',
    goal: 'Divide the grid into rectangles so each one holds exactly one number.',
    rules: [
      'Every cell belongs to exactly one rectangle, and rectangles never overlap.',
      'Each rectangle contains exactly one numbered cell, and its area (width × height) equals that number.',
      'A small shape beside the number tells you what the rectangle must look like: a wide bar, a tall bar, or a square.',
      'Drag to draw a rectangle. It stops at other rectangles instead of covering them. Tap a rectangle to remove it.',
    ],
    figures: [
      { rows: [['+4', '+', '+', '+']], caption: 'A 4 can be a bar of four cells (1×4)…' },
      { rows: [['+4', '.'], ['.', '.']], caption: '…or a 2×2 square, which is what the square symbol asks for.' },
      { rows: [['3', '.', '.'], ['.', '.', '!4']], caption: 'Wrong: one rectangle that covers both the 3 and the 4 holds two numbers. Each number needs its own rectangle.' },
    ],
    tips: ['A number that is surrounded by walls or the grid edge has few options: start there.', 'Count remaining empty cells: they must add up exactly to the sum of the numbers left.'],
  },
];

@Component({
  selector: 'app-rules',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="back" routerLink="/settings">‹ Settings</a>
    <h1>How to play</h1>
    <nav class="jump" aria-label="Games">
      @for (r of rules; track r.id) {
        <a [href]="'#' + r.id" [class.on]="focus() === r.id">{{ r.name }}</a>
      }
    </nav>

    @for (r of rules; track r.id) {
      <section class="card" [id]="r.id">
        <h2>{{ r.name }}</h2>
        <p class="goal">{{ r.goal }}</p>
        <h3>Rules</h3>
        <ol>
          @for (line of r.rules; track line) {
            <li>{{ line }}</li>
          }
        </ol>
        <h3>Examples</h3>
        @for (f of r.figures; track f.caption) {
          <figure>
            <div class="fig" [style.--cols]="f.rows[0].length">
              @for (row of f.rows; track $index) {
                @for (cell of row; track $index) {
                  <span [class.good]="cell[0] === '+'" [class.bad]="cell[0] === '!'" [class.hint]="cell[0] === '?'">{{ label(cell) }}</span>
                }
              }
            </div>
            <figcaption>{{ f.caption }}</figcaption>
          </figure>
        }
        <h3>Tips</h3>
        <ul>
          @for (t of r.tips; track t) {
            <li>{{ t }}</li>
          }
        </ul>
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
      color: var(--ink-soft);
      text-decoration: none;
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
      background: var(--surface-2, var(--surface));
      color: var(--ink);
      text-decoration: none;
      font-size: 0.9rem;
    }
    .jump a.on {
      background: var(--accent);
      color: var(--accent-contrast, #fff);
    }
    .card {
      margin-bottom: 1rem;
      scroll-margin-top: 1rem;
    }
    .goal {
      font-weight: 600;
    }
    h3 {
      margin: 1rem 0 0.3rem;
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--ink-soft);
    }
    ol,
    ul {
      margin: 0;
      padding-left: 1.2rem;
      display: grid;
      gap: 0.35rem;
    }
    figure {
      margin: 0.6rem 0;
    }
    .fig {
      display: grid;
      grid-template-columns: repeat(var(--cols), 2.6rem);
      gap: 3px;
      width: max-content;
    }
    .fig span {
      display: grid;
      place-items: center;
      height: 2.6rem;
      border-radius: 0.5rem;
      border: 1.5px solid color-mix(in srgb, var(--ink) 25%, transparent);
      background: var(--surface);
      font-weight: 700;
    }
    .fig .good {
      background: color-mix(in srgb, var(--good, #3a9d5d) 30%, var(--surface));
      border-color: var(--good, #3a9d5d);
    }
    .fig .bad {
      background: color-mix(in srgb, var(--bad) 28%, var(--surface));
      border-color: var(--bad);
    }
    .fig .hint {
      background: color-mix(in srgb, #e0b020 35%, var(--surface));
    }
    figcaption {
      margin-top: 0.4rem;
      color: var(--ink-soft);
      font-size: 0.9rem;
    }
  `,
})
export class Rules {
  protected readonly rules = RULES;
  private readonly route = inject(ActivatedRoute);
  protected readonly focus = toSignal(this.route.fragment, { initialValue: null });

  protected label(cell: string): string {
    return /^[+!?]/.test(cell) ? cell.slice(1) : cell === '.' ? '' : cell;
  }
}
