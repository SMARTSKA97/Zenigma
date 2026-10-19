import { ChangeDetectionStrategy, Component, HostListener, inject, input, output } from '@angular/core';
import { HapticsService } from '../core/haptics.service';

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

/**
 * The keyboard for games that need letters. It lives inside the game, so the phone's own keyboard never opens and never pushes the
 * page about. A computer keyboard works too. The Enter key carries the game's own word ("Guess", "Link", "Climb").
 */
@Component({
  selector: 'app-game-keyboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="kb" role="group" aria-label="Keyboard">
      @for (row of rows; track row; let r = $index) {
        <div class="keys">
          @if (r === 2) {
            <button type="button" class="key enter" [disabled]="!canEnter()" (click)="press('enter')">{{ enterLabel() }}</button>
          }
          @for (k of row.split(''); track k) {
            <button type="button" class="key" (click)="press(k)">{{ k }}</button>
          }
          @if (r === 2) {
            <button type="button" class="key wide" aria-label="Delete" (click)="press('back')">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6H9l-6 6 6 6h11z" /><path d="M13 10l4 4M17 10l-4 4" /></svg>
            </button>
          }
        </div>
      }
      @if (space()) {
        <div class="keys"><button type="button" class="key space" (click)="press(' ')">space</button></div>
      }
    </div>
  `,
  styles: `
    .kb {
      display: grid;
      gap: 0.4rem;
      width: 100%;
      user-select: none;
      -webkit-user-select: none;
      touch-action: manipulation;
    }
    .keys {
      display: flex;
      justify-content: center;
      gap: 0.3rem;
    }
    /* Raised above the app's global button styles (padding, height, shadows). */
    :host .key {
      flex: 1 1 0;
      min-width: 0;
      max-width: 3.1rem;
      min-height: 0;
      height: clamp(2.7rem, 6.6dvh, 3.4rem);
      padding: 0;
      display: grid;
      place-items: center;
      border: 0;
      border-radius: 10px;
      background: var(--key-bg);
      color: var(--text);
      font-family: var(--font-body);
      font-size: 1.05rem;
      font-weight: 650;
      text-transform: uppercase;
      box-shadow: none !important;
      -webkit-tap-highlight-color: transparent;
      transition: transform 0.1s var(--ease), background-color 0.15s var(--ease);
    }
    :host .key:active:not(:disabled) {
      transform: scale(0.92);
      background: var(--accent-soft);
    }
    :host .key.wide,
    :host .key.enter {
      flex: 1.6 1 0;
      max-width: 5rem;
      font-size: 0.85rem;
      text-transform: none;
    }
    :host .key.enter {
      background: var(--accent);
      color: var(--accent-contrast);
    }
    :host .key.enter:disabled {
      opacity: 0.45;
    }
    :host .key.space {
      flex: 1 1 0;
      max-width: 18rem;
      font-size: 0.8rem;
      letter-spacing: 0.1em;
    }
    svg {
      width: 1.4rem;
      height: 1.4rem;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  `,
})
export class GameKeyboard {
  /** The word on the Enter key. */
  readonly enterLabel = input('Enter');
  readonly canEnter = input(true);
  /** Adds a space bar, for answers of more than one word. */
  readonly space = input(false);
  readonly letter = output<string>();
  readonly backspace = output<void>();
  readonly enter = output<void>();
  private readonly haptics = inject(HapticsService);
  protected readonly rows = ROWS;

  protected press(key: string): void {
    if (key === 'enter') {
      if (!this.canEnter()) return;
      this.enter.emit();
      return;
    }
    this.haptics.tick();
    if (key === 'back') this.backspace.emit();
    else if (key === ' ') this.letter.emit(' ');
    else this.letter.emit(key);
  }

  /** A computer keyboard types into the game as well. */
  @HostListener('window:keydown', ['$event'])
  protected onKey(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    const key = event.key;
    if (key === 'Enter') this.press('enter');
    else if (key === 'Backspace') this.press('back');
    else if (key === ' ' && this.space()) this.press(' ');
    else if (/^[a-zA-Z]$/.test(key)) this.press(key.toLowerCase());
    else return;
    event.preventDefault();
  }
}
