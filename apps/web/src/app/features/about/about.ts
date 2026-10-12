import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { environment } from '../../../environments/environment';
import { UpdaterService } from '../../core/updater.service';

@Component({
  selector: 'app-about',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="back" routerLink="/settings">‹ Settings</a>
    <h1>About Zenigma</h1>
    <p class="lede">A small collection of daily and endless puzzles that work offline, made by one person.</p>

    <section class="card">
      <h2>What is inside</h2>
      <p>
        Word Guess, Queens, Tango, Sudoku (classic and mini), Zip and Patches, with more on the way. Every day brings one puzzle per game, the same for everyone,
        resetting at midnight India time. Practice has endless levels, and every level is identical for every player.
      </p>
    </section>

    <section class="card">
      <h2>Fair play</h2>
      <p>
        Daily puzzles are timed by the server and can be started once. Solutions are checked on the server against the rules of the puzzle, so leaderboards
        are honest. Practice is yours to play at your own pace, offline.
      </p>
    </section>

    <section class="card">
      <h2>Version</h2>
      <p class="muted">
        {{ platform }}{{ version() ? ' · version ' + version() : '' }}
      </p>
      <p>
        <a routerLink="/changelog">Version history</a> ·
        <a routerLink="/privacy">Privacy policy</a> ·
        <a [href]="source" target="_blank" rel="noopener">Source code</a>
      </p>
    </section>

    <section class="card">
      <h2>Feedback</h2>
      <p>
        Found a bug or have an idea? Open an issue on <a [href]="source + '/issues'" target="_blank" rel="noopener">GitHub</a>. Every message is read.
      </p>
    </section>
  `,
  styles: `
    :host {
      display: block;
      max-width: 36rem;
      margin: 0 auto;
    }
    .back {
      display: inline-block;
      margin-bottom: 0.5rem;
      color: var(--muted);
      font-weight: 600;
      text-decoration: none;
    }
    .lede {
      margin-bottom: 1.25rem;
      color: var(--muted);
    }
    section + section {
      margin-top: 1rem;
    }
    h2 {
      margin-bottom: 0.5rem;
    }
    p {
      margin: 0 0 0.5rem;
    }
  `,
})
export class About implements OnInit {
  private readonly updater = inject(UpdaterService);
  protected readonly version = this.updater.currentVersion;
  protected readonly platform = Capacitor.getPlatform() === 'android' ? 'Android app' : 'Web app';
  protected readonly source = `https://github.com/${environment.githubRepo}`;

  ngOnInit(): void {
    void this.updater.loadVersion();
  }
}
