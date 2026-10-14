/**
 * In-depth rules for every game. A figure is a small board; each cell is a string:
 *   an optional first mark: "+" good (green), "!" wrong (red), "?" look here (yellow),
 *   an optional colour "#0" to "#7" (a region or a line), then the text shown in the cell. "." is an empty cell.
 */
export interface Figure {
  rows: string[][];
  caption: string;
}

export interface Step {
  text: string;
  figure?: Figure;
}

export interface Technique {
  title: string;
  text: string;
  figure?: Figure;
}

export interface GameRules {
  id: string;
  name: string;
  tagline: string;
  goal: string;
  rules: string[];
  /** A real level solved step by step. */
  example: { title: string; steps: Step[] };
  techniques: Technique[];
  mistakes: string[];
  tips: string[];
  /** How the daily and practice versions differ, if they do. */
  modes?: string;
}

const hintsNote = 'In Practice, the Hint button points at where to look next and says why. It never fills in the answer.';

export const GAME_RULES: GameRules[] = [
  {
    id: 'word-guess',
    name: 'Word Guess',
    tagline: 'Five letters, six tries.',
    goal: 'Find the hidden five-letter word in six guesses or fewer.',
    rules: [
      'Type a real five-letter word and press Enter. Words that are not in the list are rejected and cost nothing.',
      'Every letter is coloured: green means the right letter in the right place, yellow means the letter is in the word but somewhere else, grey means it is not in the word.',
      'Repeated letters are counted. If the word has one E and your guess has two, only one of them can be green or yellow, and the extra one turns grey.',
      'The keyboard keeps track: each key shows the best result that letter has had so far.',
      'Hard mode (in Settings) makes you reuse every green and yellow letter you have found in your next guess.',
    ],
    example: {
      title: 'Solving TRACE in three guesses',
      steps: [
        {
          text: 'Start with a word that has common, different letters. Say you try CRANE. R, A and E are green, C is yellow, N is grey.',
          figure: { rows: [['?C', '+R', '+A', '.N', '+E']], caption: 'CRANE: the word looks like _ R A _ E, it contains a C, and has no N.' },
        },
        {
          text: 'C is in the word but not first. Positions 1 and 4 are free, so C must be 4th: the word is _RACE. Many first letters fit (BRACE, GRACE, TRACE…). A guess like GRACE tests one of them.',
          figure: { rows: [['.G', '+R', '+A', '+C', '+E']], caption: 'GRACE: everything fits except the G. Now only the first letter is unknown.' },
        },
        {
          text: 'Of the words left (BRACE, TRACE), try one. T is right.',
          figure: { rows: [['+T', '+R', '+A', '+C', '+E']], caption: 'Solved in three.' },
        },
      ],
    },
    techniques: [
      {
        title: 'Duplicate letters',
        text: 'Greens are counted first. Yellows then use up whatever copies of the letter are left. With the answer APPLE and the guess PAPER, the P in the middle is green, the first P is yellow (the answer has a second P), and the R is grey.',
        figure: { rows: [['?P', '?A', '+P', '?E', '.R']], caption: 'PAPER against APPLE.' },
      },
      {
        title: 'Break up a crowded pattern',
        text: 'If you know _ATCH, the answers BATCH, CATCH, HATCH, LATCH, MATCH, PATCH and WATCH are all left. Guessing them one by one can take six tries. Instead, play a word that tests several first letters at once, such as a word with B, C and L in it.',
      },
      {
        title: 'Use grey letters',
        text: 'A grey letter is information too. It removes every word with that letter from the list, so a first guess with five new letters rules out a lot.',
      },
    ],
    mistakes: ['Repeating a letter you already know is grey.', 'Putting a yellow letter back in the same place.', 'Guessing words that cannot fit the green letters (use the keyboard colours to check).'],
    tips: ['Open with vowels and common consonants such as R, S, T, L, N.', 'Plan guess 2 to use new letters, not just the same ones in a new order.', 'On the last guesses, count the words that still fit; do not guess blindly.'],
    modes: 'The daily word is the same for everyone and resets at midnight India time. Practice has unlimited words and works offline.',
  },
  {
    id: 'queens',
    name: 'Queens',
    tagline: 'One queen per row, column and colour.',
    goal: 'Place exactly one queen in every row, every column and every coloured region.',
    rules: [
      'The board is split into coloured regions. There are as many regions as rows and columns.',
      'Each row, each column and each region holds exactly one queen.',
      'No two queens may touch, not even diagonally. A queen can be a knight’s move away, but not one step in any direction.',
      'Tap once to put a ✕ (a note that no queen goes here), tap again for a queen, tap a third time to clear the cell. Some puzzles start with queens already placed; they cannot be moved.',
    ],
    example: {
      title: 'A 5×5 level, step by step',
      steps: [
        {
          text: 'This puzzle starts with three queens already placed. There are five colours, five rows and five columns.',
          figure: {
            rows: [
              ['#0', '#0', '#0', '#0', '#0'],
              ['#0', '#0', '#1', '#1♛', '#0'],
              ['#2♛', '#0', '#1', '#1', '#3'],
              ['#0', '#0', '#0', '#1', '#3'],
              ['#4', '#4', '#4♛', '#4', '#3'],
            ],
            caption: 'Rows 2, 3 and 5 and columns 1, 3 and 4 are used up by the given queens.',
          },
        },
        {
          text: 'Look at the strip of three cells in the right-hand column (one colour). Its queen must be in row 3, 4 or 5, but rows 3 and 5 are taken. So its queen is in row 4.',
          figure: {
            rows: [
              ['#0', '#0', '#0', '#0', '#0'],
              ['#0', '#0', '#1', '#1♛', '#0'],
              ['#2♛', '#0', '#1', '#1', '!#3✕'],
              ['#0', '#0', '#0', '#1', '+#3♛'],
              ['#4', '#4', '#4♛', '#4', '!#3✕'],
            ],
            caption: 'Two ✕ and one forced queen.',
          },
        },
        {
          text: 'Only the first row and the second column are left, and the big region still needs its queen. The one cell where they meet is the last queen.',
          figure: {
            rows: [
              ['#0', '+#0♛', '#0', '#0', '#0'],
              ['#0', '#0', '#1', '#1♛', '#0'],
              ['#2♛', '#0', '#1', '#1', '#3'],
              ['#0', '#0', '#0', '#1', '#3♛'],
              ['#4', '#4', '#4♛', '#4', '#3'],
            ],
            caption: 'Solved: one queen per row, column and colour, none touching.',
          },
        },
      ],
    },
    techniques: [
      {
        title: 'A region with one cell',
        text: 'If a region has only one cell, that cell holds its queen. Cross out the rest of its row, column and its eight neighbours.',
      },
      {
        title: 'A region that fits in one line',
        text: 'If every cell of a region lies in one row (or one column), the queen of that row belongs to the region. Cross out every other cell in that row, even those of other colours.',
        figure: {
          rows: [['?#3', '?#3', '?#3', '!#0✕', '!#1✕']],
          caption: 'The yellow region lies only in this row, so the other cells of the row can never hold a queen.',
        },
      },
      {
        title: 'Touching rules out cells',
        text: 'Every queen rules out the eight cells around it. After you place one, mark those with ✕ so the next step is easier to see.',
        figure: {
          rows: [['!✕', '!✕', '!✕'], ['!✕', '+♛', '!✕'], ['!✕', '!✕', '!✕']],
          caption: 'A queen and the cells it rules out.',
        },
      },
      {
        title: 'Counting regions against lines',
        text: 'If two regions fit only inside the same two rows, those rows belong to those regions. Every other region must keep its queen out of them.',
      },
    ],
    mistakes: ['Forgetting diagonal neighbours.', 'Placing a queen in a region that already has one far away.', 'Crossing out a cell by mistake: Check and Hint will show if a ✕ hides a queen.'],
    tips: ['Start with the smallest regions.', hintsNote, 'If you are stuck, assume a queen in a cell and see if it leaves some region with no room.'],
  },
  {
    id: 'tango',
    name: 'Tango',
    tagline: 'Suns and moons, never three in a row.',
    goal: 'Fill the 6×6 grid with suns and moons so every rule holds.',
    rules: [
      'Every row and every column has exactly three suns and three moons.',
      'No more than two of the same symbol may sit next to each other, in a row or in a column.',
      'A = sign between two cells means they are the same symbol. A × sign means they are different.',
      'Some cells start filled in and cannot be changed. Tap a cell to cycle between sun, moon and empty.',
    ],
    example: {
      title: 'The four rules that solve most of the grid',
      steps: [
        {
          text: 'Two of the same side by side: the cells at both ends can’t match them, or there would be three in a row.',
          figure: { rows: [['+☀', '+☀', '?☾', '.', '.', '.']], caption: 'Two suns next to each other: the next cell must be a moon.' },
        },
        {
          text: 'A gap between two of the same: it must hold the other symbol.',
          figure: { rows: [['.', '+☾', '?☀', '+☾', '.', '.']], caption: 'A sun in the gap, otherwise three moons would be possible later.' },
        },
        {
          text: 'A row that already has three of one symbol: all its other cells are the other symbol.',
          figure: { rows: [['+☀', '?☾', '+☀', '?☾', '+☀', '?☾']], caption: 'Three suns used up, so the rest are moons.' },
        },
        {
          text: 'A sign next to a filled cell decides the neighbour. = copies it, × flips it.',
          figure: { rows: [['+☀', '=', '?☀', '.', '.', '.'], ['+☀', '×', '?☾', '.', '.', '.']], caption: 'The same sun, with an = and then a × beside it.' },
        },
      ],
    },
    techniques: [
      {
        title: 'Lines that are nearly full',
        text: 'Count the suns and moons in each row and column. The line closest to done has the fewest possibilities. Fill it first.',
      },
      {
        title: 'Avoid three in a row twice',
        text: 'If putting a sun in a cell would make three suns in a row in one direction, it is a moon there, even if the other direction looked free.',
      },
      {
        title: 'Try and see',
        text: 'If nothing is obvious, pick the cell with the fewest options and ask what breaks if it is a sun. If the grid cannot be finished, it is a moon.',
      },
    ],
    mistakes: ['Counting only one direction: every cell sits in a row and a column.', 'Reading × as “moon”. It means the two cells differ, not what they are.'],
    tips: ['Go through the = and × signs first, they are free information.', hintsNote, 'Always finish a row once it has three of one symbol.'],
  },
  {
    id: 'sudoku',
    name: 'Sudoku',
    tagline: 'Classic 9×9 and a quick 6×6 mini.',
    goal: 'Fill every cell so each row, column and box has each number exactly once.',
    rules: [
      'Classic is a 9×9 grid with the numbers 1 to 9 and nine 3×3 boxes. Mini is 6×6 with 1 to 6 and six boxes that are 2 rows tall and 3 columns wide.',
      'Every row, every column and every box contains each number exactly once.',
      'Every puzzle has exactly one solution. You never need to guess.',
      'Kinds with one more rule: Diagonal (both long diagonals hold 1 to 9), Windoku (four shaded 3×3 windows hold 1 to 9), Disjoint Groups (the cells in the same spot of every box, such as all top-left cells, hold 1 to 9) Anti-Knight (no number repeats a chess knight’s move away), Anti-King (nor a king’s step away, diagonals included) and Non-consecutive (cells that share an edge never hold numbers one apart, such as 4 and 5).',
      'Kinds with clues drawn on the grid: Killer (dashed cages with a sum; a cage never repeats a number), Thermo (numbers rise from the round bulb to the tip), Jigsaw (nine irregular regions replace the 3×3 boxes), Arrow (the numbers along an arrow add up to the number in its circle), Sandwich (the clue outside a row or column is the sum of the numbers between its 1 and its 9), Little Killer (a clue outside the grid is the sum of the numbers on the diagonal it points along; numbers may repeat on a diagonal), Kropki (a white dot between two cells means their numbers differ by 1, a black dot that one is double the other, and with no dot neither is true), Renban (the numbers on a purple line are different and form a run, like 3-4-5 in any order), Consecutive (a bar between two cells means their numbers differ by 1, and cells with no bar never do) and Even-Odd (a circle holds an even number, a square an odd one).',
      'Tap a cell, then a number. Use Notes to jot down candidate numbers in a cell; they disappear when you place a number in the cell.',
    ],
    example: {
      title: 'A mini puzzle: the top-left cell',
      steps: [
        {
          text: 'The mini grid has six boxes, drawn here in two alternating colours. Each box is 2 rows by 3 columns.',
          figure: {
            rows: [
              ['#0', '#0', '#0', '#1', '#1', '#1'],
              ['#0', '#0', '#0', '#1', '#1', '#1'],
              ['#1', '#1', '#1', '#0', '#0', '#0'],
              ['#1', '#1', '#1', '#0', '#0', '#0'],
              ['#0', '#0', '#0', '#1', '#1', '#1'],
              ['#0', '#0', '#0', '#1', '#1', '#1'],
            ],
            caption: 'Six boxes of six cells.',
          },
        },
        {
          text: 'In the real puzzle the first row reads _ 3 6 2 4 _. It misses 1 and 5. The top-left cell is either 1 or 5. Look down its column: there is a 5 in it, further down. So the cell is 1.',
          figure: {
            rows: [
              ['?#7', '#73', '#76', '#72', '#74', '#7'],
              ['#7', '', '4', '3', '1', '6'],
              ['#7', '', '2', '5', '6', ''],
              ['#76', '', '', '1', '', ''],
              ['!#75', '', '3', '', '2', ''],
              ['#74', '', '1', '6', '', '3'],
            ],
            caption: 'The row (yellow) lacks 1 and 5. The column already has a 5 (red), so the corner is 1.',
          },
        },
      ],
    },
    techniques: [
      {
        title: 'Only one number fits (naked single)',
        text: 'For an empty cell, list the numbers its row, column and box already have. If only one number is left, it goes there.',
      },
      {
        title: 'Only one place for a number (hidden single)',
        text: 'Pick a number and a box (or row, or column). If every other cell in it is ruled out for that number, the remaining cell must hold it.',
        figure: { rows: [['!5', '!5', '.', '.', '!5', '.'], ['.', '.', '.', '.', '.', '.']], caption: 'Three cells in this row can’t hold a 5. If the rest are blocked too, the last cell takes it.' },
      },
      {
        title: 'Pencil notes',
        text: 'When no cell is obvious, write the candidates into each cell with Notes. Pairs of cells with the same two candidates (naked pairs) remove those numbers from the rest of their row, column or box.',
      },
    ],
    mistakes: ['Putting a number that clashes with a box neighbour you did not look at.', 'Forgetting that boxes in mini are 2 tall and 3 wide.', 'Guessing. If you are stuck, add notes instead.'],
    tips: ['Scan for the numbers that appear most often on the board and find where the missing copies go.', hintsNote, 'Check boxes as well as rows: many missed placements hide there.'],
    modes: 'The daily is a Sudoku of the day’s difficulty. Practice has endless levels in both Classic and Mini.',
  },
  {
    id: 'zip',
    name: 'Zip',
    tagline: 'One path through every cell.',
    goal: 'Draw a single path from 1 to the highest number that passes through every cell exactly once.',
    rules: [
      'Start on the cell numbered 1 and end on the highest number.',
      'Move up, down, left or right. No diagonals, and no cell may be visited twice.',
      'Every cell of the grid must be on the path.',
      'The numbers must be reached in order: 1, then 2, then 3 and so on.',
      'Drag to draw. Drag back over the path to undo steps, or press a cell on the path to cut it back there.',
    ],
    example: {
      title: 'A 5×5 level and its path',
      steps: [
        {
          text: 'Here are the numbers: 1 to 9 are scattered around the board. The path has to touch all 25 cells and pass 1, 2, 3… 9 in order.',
          figure: {
            rows: [
              ['.', '.', '.', '.', '7'],
              ['.', '1', '.', '9', '.'],
              ['.', '2', '.', '.', '6'],
              ['.', '.', '8', '.', '5'],
              ['3', '.', '.', '.', '4'],
            ],
            caption: 'The puzzle.',
          },
        },
        {
          text: 'From 1 the path goes up and left to the corner, down the left edge to 2, then down and back left to 3. It runs along the bottom to 4, climbs the right edge through 5 and 6 to 7 in the top-right corner, then snakes back through 8 to finish on 9.',
          figure: {
            rows: [
              ['↓', '←', '↓', '←', '+7'],
              ['↓', '+1↑', '↓', '+9', '↑'],
              ['→', '+2↓', '↓', '↑', '+6↑'],
              ['↓', '←', '+8↑', '↑', '+5↑'],
              ['+3→', '→', '→', '→', '+4↑'],
            ],
            caption: 'One solution path, shown by arrows. It ends on 9.',
          },
        },
      ],
    },
    techniques: [
      {
        title: 'Corners use both neighbours',
        text: 'A corner cell has only two neighbours, so the path enters through one and leaves through the other. Join them first.',
      },
      {
        title: 'Never strand a cell',
        text: 'If a cell is left with only one free neighbour, the path must end there, but it can only end on the last number. Watch for cells you are about to cut off.',
      },
      {
        title: 'Work from the high numbers too',
        text: 'The path ends on the highest number. Trace backwards from it as well as forwards from 1 and meet in the middle.',
      },
      {
        title: 'Next stop, then the walls',
        text: 'The cells hugging the edge are the easiest to strand. When you move along a wall, think how the cells beside it will be reached later.',
      },
    ],
    mistakes: ['Taking a shortcut to the next number and leaving cells behind.', 'Ending on a number that is not the highest.'],
    tips: ['Hint tells you the next stop and what to count.', 'Drag back a few steps instead of starting again.', 'Many solutions snake along the edges and fill the middle last.'],
  },
  {
    id: 'patches',
    name: 'Patches',
    tagline: 'Cut the grid into rectangles.',
    goal: 'Divide the whole grid into rectangles, each with one number equal to its area.',
    rules: [
      'Every cell belongs to exactly one rectangle and rectangles never overlap.',
      'Every rectangle holds exactly one numbered cell.',
      'The number is the rectangle’s area: width times height. A 6 can be 1×6, 2×3, 3×2 or 6×1.',
      'A small shape beside a number is a clue: a wide bar (more columns than rows), a tall bar, or a square.',
      'Drag across cells to draw a rectangle. It stops at other rectangles instead of covering them. Tap a rectangle to remove it.',
    ],
    example: {
      title: 'A 5×5 level, step by step',
      steps: [
        {
          text: 'The numbers add up to 25, the number of cells (4 + 6 + 4 + 2 + 2 + 6 + 1). That is always true, so it is a good check.',
          figure: {
            rows: [
              ['.', '.', '.', '4', '.'],
              ['.', '6', '.', '.', '.'],
              ['.', '.', '.', '.', '4'],
              ['2', '2', '6', '.', '.'],
              ['.', '.', '.', '.', '1'],
            ],
            caption: 'The puzzle. The numbers are 4, 6, 4, 2, 2, 6 and 1.',
          },
        },
        {
          text: 'Place what is certain first. The 1 stands alone. The 2 with the tall shape beside it must be a vertical bar, and the 4 with the square symbol is 2×2. Each placement leaves fewer options for the numbers around it.',
          figure: {
            rows: [
              ['.', '.', '.', '4', '.'],
              ['.', '6', '.', '.', '.'],
              ['.', '.', '.', '.', '4'],
              ['2', '2', '6', '.', '.'],
              ['.', '.', '.', '.', '#61'],
            ],
            caption: 'The 1 is its own rectangle.',
          },
        },
        {
          text: 'Keep going with the number that has the fewest options left. Here is the finished board, with each rectangle in its own colour. Check each one: 2×2 = 4, 3×2 = 6, 1×4 = 4, 2×1 = 2, 2×1 = 2, 3×2 = 6, 1×1 = 1.',
          figure: {
            rows: [
              ['#1', '#1', '#0', '#04', '#2'],
              ['#1', '#16', '#0', '#0', '#2'],
              ['#1', '#1', '#5', '#5', '#24'],
              ['#32', '#42', '#56', '#5', '#2'],
              ['#3', '#4', '#5', '#5', '#61'],
            ],
            caption: 'Solved: seven rectangles that cover all 25 cells, each with one number and the right area.',
          },
        },
      ],
    },
    techniques: [
      {
        title: 'Ones and shape clues',
        text: 'A 1 is a single cell. A tall or wide shape symbol cuts the possibilities down at once; a 2 with a shape is a fixed bar direction.',
      },
      {
        title: 'Numbers against walls',
        text: 'A big number in a corner has few ways to grow. List the rectangles that fit and rule out any that would swallow another number.',
      },
      {
        title: 'Count the empty cells',
        text: 'The remaining empty cells always equal the sum of the numbers not yet placed. If a gap is too small for the neighbouring number, that rectangle has to go elsewhere.',
      },
      {
        title: 'Between two numbers',
        text: 'A cell with two numbers on either side must belong to one of them. Check which rectangle can reach it without covering the other number.',
      },
    ],
    mistakes: ['Giving a rectangle two numbers.', 'Leaving a lonely empty cell that no number can reach.', 'Forgetting the shape symbol: a square 4 is 2×2, not 1×4.'],
    tips: ['Hint picks the number with the fewest options left and tells you why.', 'A wrong rectangle often stops another number from fitting; use Check to see if any rectangle is off.', 'Tap to remove a rectangle; the board never overwrites one for you.'],
  },
];

export const RULES_BY_ID = new Map(GAME_RULES.map((g) => [g.id, g]));
