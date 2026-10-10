import { Signal } from '@angular/core';
import { Mark, Status } from './engine';

export interface BoardRow {
  letters: string[];
  marks: Mark[];
  submitted: boolean;
}

export interface BoardStats {
  played: number;
  won: number;
  distribution: number[];
}

/** What the Word Guess screen needs from a game mode (practice or daily), so one board serves both. */
export interface BoardController {
  readonly rows: Signal<BoardRow[]>;
  readonly keyMarks: Signal<Map<string, Mark>>;
  readonly message: Signal<string | null>;
  readonly shakeRow: Signal<number | null>;
  readonly revealing: Signal<boolean>;
  readonly finished: Signal<boolean>;
  readonly status: Signal<Status>;
  readonly answer: Signal<string | null>;
  readonly stats: Signal<BoardStats>;
  /** True once a guess has been made in an unfinished game: the mode (hard or not) can no longer change. */
  readonly modeLocked: Signal<boolean>;
  type(letter: string): void;
  erase(): void;
  enter(): Promise<void>;
  share(): string;
}
