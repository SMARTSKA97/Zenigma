import { Injectable } from '@angular/core';

export interface Words {
  valid: Set<string>;
  answers: string[];
}

/** The word lists are a separate chunk, loaded the first time a Word Guess screen needs them. */
@Injectable({ providedIn: 'root' })
export class WordListService {
  private words?: Promise<Words>;

  load(): Promise<Words> {
    this.words ??= (async () => {
      const [{ GUESSES }, { ANSWERS }] = await Promise.all([import('./data/guesses'), import('./data/answers')]);
      return { valid: new Set(GUESSES.split('\n')), answers: ANSWERS.split('\n') };
    })();
    return this.words;
  }
}
