import { DecimalPipe } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { PrefsService } from '../../core/prefs.service';
import { ThemeMode, ThemeService } from '../../core/theme.service';
import { UpdaterService } from '../../core/updater.service';

@Component({
  selector: 'app-settings',
  template: `
    <h1>Settings</h1>

    <section class="card">
      <h2>Appearance</h2>
      <div class="segmented" role="radiogroup" aria-label="Theme">
        @for (option of options; track option) {
          <button
            type="button"
            role="radio"
            [attr.aria-checked]="theme.mode() === option"
            [class.on]="theme.mode() === option"
            (click)="theme.set(option)"
          >
            {{ option }}
          </button>
        }
      </div>
      <label class="check">
        <input type="checkbox" [checked]="prefs.highContrast()" (change)="prefs.setHighContrast($any($event.target).checked)" />
        Colour-blind friendly colours (orange and blue)
      </label>
    </section>

    @if (updater.supported) {
      <section class="card">
        <h2>App updates</h2>
        <p class="muted">Version {{ updater.currentVersion() ?? '-' }}. Updates come from GitHub Releases.</p>

        @switch (updater.state()) {
          @case ('checking') {
            <p class="muted">Checking...</p>
          }
          @case ('upToDate') {
            <p>You are on the latest version.</p>
          }
          @case ('available') {
            <p>
              <strong>Version {{ updater.update()?.version }}</strong> is available.
            </p>
            @if (updater.update()?.notes) {
              <pre class="notes">{{ updater.update()?.notes }}</pre>
            }
            <button type="button" (click)="updater.install()">Download and install</button>
          }
          @case ('downloading') {
            <div class="bar" role="progressbar" [attr.aria-valuenow]="(updater.progress() * 100) | number: '1.0-0'">
              <span [style.transform]="'scaleX(' + updater.progress() + ')'"></span>
            </div>
          }
          @case ('needsPermission') {
            <p>Android needs your permission to install updates from Zenigma.</p>
            <button type="button" (click)="updater.allowInstalls()">Open settings</button>
          }
          @case ('error') {
            <p class="error">{{ updater.message() }}</p>
          }
        }

        @if (updater.state() !== 'checking' && updater.state() !== 'downloading') {
          <button type="button" class="secondary" (click)="updater.check()">Check for updates</button>
        }
      </section>
    }
  `,
  styles: `
    section + section {
      margin-top: 1rem;
    }
    .segmented {
      display: flex;
      max-width: 22rem;
      padding: 0.2rem;
      gap: 0.2rem;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 999px;
    }
    .segmented button {
      text-transform: capitalize;
      white-space: nowrap;
      padding-inline: 0.9rem;
      border: 0;
      background: transparent;
      color: var(--muted);
      border-radius: 999px;
      flex: 1;
    }
    .segmented button.on {
      background: var(--accent);
      color: var(--accent-contrast);
    }
    .check {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 0.6rem;
      margin-top: 1rem;
      color: var(--text);
    }
    .check input {
      width: 1.1rem;
      height: 1.1rem;
      min-height: 0;
      accent-color: var(--accent);
    }
    .notes {
      white-space: pre-wrap;
      font: inherit;
      color: var(--muted);
      margin: 0 0 1rem;
    }
    .bar {
      height: 6px;
      border-radius: 99px;
      background: var(--border);
      overflow: hidden;
      margin-bottom: 1rem;
    }
    .bar span {
      display: block;
      height: 100%;
      background: var(--accent);
      transform-origin: left;
      transition: transform 0.25s ease-out;
    }
  `,
  imports: [DecimalPipe],
})
export class Settings implements OnInit {
  protected readonly theme = inject(ThemeService);
  protected readonly updater = inject(UpdaterService);
  protected readonly prefs = inject(PrefsService);
  protected readonly options: ThemeMode[] = ['system', 'light', 'dark'];

  ngOnInit(): void {
    void this.updater.loadVersion();
  }
}
