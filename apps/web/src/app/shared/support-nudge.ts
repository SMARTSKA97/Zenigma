import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PlayerService } from '../core/player.service';
import { SupportService } from '../core/support.service';
import { Sheet } from './sheet';

const KEY = 'zenigma.nudge';
const DAY = 86_400_000;

export interface NudgeState {
  /** When the app was first opened (ms). */
  first: number;
  /** When the prompt was last shown (ms), 0 for never. */
  last: number;
  never: boolean;
}

/** A kind, rare ask: only after a real week of use and plenty of play, at most once a month, and never again after "Don't ask again". */
export function shouldNudge(state: NudgeState, levelsCleared: number, now: number): boolean {
  if (state.never) return false;
  if (now - state.first < 7 * DAY) return false;
  if (levelsCleared < 30) return false;
  return state.last === 0 || now - state.last >= 30 * DAY;
}

function read(): NudgeState {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<NudgeState> | null;
    return { first: v?.first ?? Date.now(), last: v?.last ?? 0, never: v?.never ?? false };
  } catch {
    return { first: Date.now(), last: 0, never: true }; // no storage: never ask, since "not again" could not be remembered
  }
}
function write(s: NudgeState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* nothing to remember it in */
  }
}

/** "Zenigma is one person": a quiet, occasional prompt on the Home screen that opens the Support sheet. */
@Component({
  selector: 'app-support-nudge',
  imports: [Sheet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (show()) {
      <app-sheet label="Support Zenigma" (closed)="later()">
        <div class="box">
          <span class="heart" aria-hidden="true">♥</span>
          <h2>Zenigma is one person</h2>
          <p class="muted">
            The app, the daily puzzles, the leaderboards and the servers are all made and paid for by one person. No tracking, no ads. If Zenigma has
            saved you some boredom, a small tip keeps it alive. It unlocks nothing.
          </p>
          <button type="button" (click)="support()">Support Zenigma</button>
          <div class="row">
            <button type="button" class="secondary" (click)="never()">Don’t ask again</button>
            <button type="button" class="secondary" (click)="later()">Maybe later</button>
          </div>
        </div>
      </app-sheet>
    }
  `,
  styles: `
    .box { display: grid; justify-items: center; gap: 0.7rem; text-align: center; }
    .box h2, .box p { margin: 0; }
    .heart { display: grid; place-items: center; width: 3.4rem; height: 3.4rem; border-radius: 42% 58% 52% 48% / 52% 44% 56% 48%; background: #db61a2; color: #fff; font-size: 1.6rem; }
    .box > button { width: 100%; }
    .row { display: flex; gap: 0.6rem; width: 100%; }
    .row button { flex: 1; }
  `,
})
export class SupportNudge implements OnInit {
  private readonly router = inject(Router);
  private readonly s = inject(SupportService);
  private readonly player = inject(PlayerService);
  protected readonly show = signal(false);
  private state = read();

  ngOnInit(): void {
    write(this.state); // remembers the first day
    this.player.start();
    // Give the saved levels a moment to load; ask only on Home, never in the middle of a game.
    setTimeout(() => {
      const home = this.router.url.split('?')[0] === '/';
      if (home && this.s.canDonate() && !this.s.open() && shouldNudge(this.state, this.player.levelsCleared(), Date.now())) {
        this.state = { ...this.state, last: Date.now() };
        write(this.state);
        this.show.set(true);
      }
    }, 6000);
  }

  protected support(): void {
    this.show.set(false);
    this.s.open.set(true);
  }
  protected later(): void {
    this.show.set(false);
  }
  protected never(): void {
    this.state = { ...this.state, never: true };
    write(this.state);
    this.show.set(false);
  }
}
