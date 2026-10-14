import { describe, expect, it } from 'vitest';
import evenodd from '../../../../public/levels/sudoku-even-odd-0.json';
import consecutive from '../../../../public/levels/sudoku-consecutive-0.json';
import thermo from '../../../../public/levels/sudoku-thermo-0.json';
import killer from '../../../../public/levels/sudoku-killer-0.json';
import jigsaw from '../../../../public/levels/sudoku-jigsaw-0.json';
import arrow from '../../../../public/levels/sudoku-arrow-0.json';
import renban from '../../../../public/levels/sudoku-renban-0.json';
import kropki from '../../../../public/levels/sudoku-kropki-0.json';
import little from '../../../../public/levels/sudoku-little-0.json';
import sandwich from '../../../../public/levels/sudoku-sandwich-0.json';
import { conflicts, SudokuPuzzle, verify } from './engine';
import { solveKind } from './kinds';

const PACKS: Record<string, SudokuPuzzle[]> = {
  'even-odd': evenodd as SudokuPuzzle[],
  'consecutive': consecutive as SudokuPuzzle[],
  'thermo': thermo as SudokuPuzzle[],
  'killer': killer as SudokuPuzzle[],
  'jigsaw': jigsaw as SudokuPuzzle[],
  'arrow': arrow as SudokuPuzzle[],
  'sandwich': sandwich as SudokuPuzzle[],
  'renban': renban as SudokuPuzzle[],
  'kropki': kropki as SudokuPuzzle[],
  'little': little as SudokuPuzzle[],
};

describe('Sudoku kinds', () => {
  for (const [kind, pack] of Object.entries(PACKS)) {
    it(`${kind}: levels solve to one grid that the verifier accepts`, () => {
      for (const p of [pack[0], pack[1], pack[500], pack[999]]) {
        expect(p.rule).toBe(kind);
        expect(conflicts([...p.givens].map(Number), p).size).toBe(0);
        const solution = solveKind(p);
        expect(solution).not.toBeNull();
        expect(verify(p, solution)).toBe(true);
        // Changing one placed digit breaks it.
        const at = [...p.givens].findIndex((g) => g === '0');
        const wrong = solution!.slice(0, at) + String((Number(solution![at]) % 9) + 1) + solution!.slice(at + 1);
        expect(verify(p, wrong)).toBe(false);
      }
    });
  }
});
