import { ChangeDetectionStrategy, Component, inject, input, OnDestroy, OnInit } from '@angular/core';
import { BackService } from '../core/back.service';

/**
 * A game screen that fits the phone exactly, so the page never scrolls: a slim bar on top (a close button, the title and whatever
 * is projected as `[end]`), the play area in the middle, and a dock for the keyboard or buttons pinned to the bottom edge.
 * It sits over the tab bar while a game is on, and keeps clear of the status bar and the gesture bar.
 *
 *     <app-play-screen title="Wend" subtitle="Monday">
 *       <span end>3 of 5</span>
 *       …the game…
 *       <div dock>…keyboard or buttons…</div>
 *     </app-play-screen>
 */
@Component({
  selector: 'app-play-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="screen">
      <header class="bar">
        <button type="button" class="quit" aria-label="Leave" (click)="leave($event)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <div class="title">
          <b>{{ title() }}</b>
          @if (subtitle()) {
            <small>{{ subtitle() }}</small>
          }
        </div>
        <div class="end"><ng-content select="[end]" /></div>
      </header>
      <div class="body"><div class="inner"><ng-content /></div></div>
      <div class="dock"><ng-content select="[dock]" /></div>
    </div>
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 80;
      display: block;
      background: var(--bg);
      color: var(--text);
    }
    .screen {
      height: 100%;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      max-width: 34rem;
      margin: 0 auto;
      padding: calc(0.6rem + env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) calc(0.6rem + env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left));
    }
    .bar {
      display: flex;
      align-items: center;
      gap: 0.7rem;
      min-height: 2.7rem;
    }
    :host .quit {
      flex: none;
      display: grid;
      place-items: center;
      width: 2.6rem;
      min-height: 0;
      height: 2.6rem;
      padding: 0;
      border-radius: 50%;
      background: var(--surface);
      border: 1px solid var(--border);
      color: var(--text);
      box-shadow: none;
    }
    .quit svg {
      width: 1.3rem;
      height: 1.3rem;
      fill: none;
      stroke: currentColor;
      stroke-width: 2.2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .title {
      flex: 1;
      min-width: 0;
      display: grid;
      line-height: 1.15;
    }
    .title b {
      font-family: var(--font-display);
      font-size: 1.2rem;
      letter-spacing: -0.02em;
    }
    .title small {
      color: var(--muted);
      font-size: 0.78rem;
    }
    .end {
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .end ::ng-deep > * {
      display: flex;
      align-items: center;
      gap: 0.7rem;
    }
    /* The play area is centred when it fits, and scrolls inside itself (never the page) on a very small screen. */
    .body {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-width: none;
    }
    .inner {
      margin-block: auto;
      width: 100%;
      display: grid;
      gap: 0.8rem;
      justify-items: center;
    }
    .dock {
      display: grid;
      gap: 0.5rem;
    }
    .dock:empty {
      display: none;
    }
  `,
})
export class PlayScreen implements OnInit, OnDestroy {
  readonly title = input('');
  readonly subtitle = input('');
  private readonly back = inject(BackService);

  ngOnInit(): void {
    // The page behind must not scroll or bounce while a game is on.
    document.documentElement.classList.add('lock');
  }

  ngOnDestroy(): void {
    document.documentElement.classList.remove('lock');
  }

  /** Like the Back button: a round in progress asks before it is given up. */
  protected leave(event: Event): void {
    this.back.up(event);
  }
}
