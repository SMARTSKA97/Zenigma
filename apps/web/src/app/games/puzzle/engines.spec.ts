import sudoku from '../../../../../../tests/vectors/puzzles/sudoku.json';
import queens from '../../../../../../tests/vectors/puzzles/queens.json';
import tango from '../../../../../../tests/vectors/puzzles/tango.json';
import { verify as verifyQueens } from '../queens/engine';
import { verify as verifySudoku } from '../sudoku/engine';
import { verify as verifyTango } from '../tango/engine';

interface Case {
  name: string;
  puzzle: any;
  solution: unknown;
  valid: boolean;
}

describe('puzzle rules (shared vectors, also run by the API)', () => {
  const suites: [string, Case[], (p: any, s: unknown) => boolean][] = [
    ['queens', queens as Case[], verifyQueens],
    ['tango', tango as Case[], verifyTango],
    ['sudoku', sudoku as Case[], verifySudoku],
  ];
  for (const [game, cases, verify] of suites) {
    for (const c of cases) {
      it(`${game}: ${c.name}`, () => {
        expect(verify(c.puzzle, c.solution)).toBe(c.valid);
      });
    }
  }
});
