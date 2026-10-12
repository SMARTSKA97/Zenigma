import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Loader } from '../../shared/loader';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { Switch } from '../../shared/switch';
import { PrefsService } from '../../core/prefs.service';
import { ThemeMode, ThemeService } from '../../core/theme.service';
import { UpdaterService } from '../../core/updater.service';

@Component({
  selector: 'app-settings',
  imports: [RouterLink, Loader, Segmented, Switch],
  template: `
    <h1>Settings</h1>

    <section class="card">
      <h2>Appearance</h2>
      <app-segmented label="Theme" [options]="themes" [value]="theme.mode()" (valueChange)="theme.set($event)" />
      <div class="gap"></div>
      <app-switch [checked]="prefs.highContrast()" (checkedChange)="prefs.setHighContrast($event)">
        Colour-blind friendly colours
        <small>Orange and blue, plus letters on Queens regions.</small>
      </app-switch>
      <div class="gap"></div>
      <app-switch [checked]="prefs.reduceMotion()" (checkedChange)="prefs.setReduceMotion($event)">
        Reduce motion
        <small>Turns off board animations and confetti.</small>
      </app-switch>
      <div class="gap"></div>
      <app-switch [checked]="prefs.haptics()" (checkedChange)="prefs.setHaptics($event)">
        Vibration
        <small>Small taps as you play, and a pattern for mistakes and wins.</small>
      </app-switch>
    </section>

    @if (updater.supported) {
      <section class="card">
        <h2>App updates</h2>
        <p class="muted">Version {{ updater.currentVersion() ?? '-' }}</p>

        @switch (updater.state()) {
          @case ('checking') {
            <p class="status"><app-loader [size]="18" /> Checking for updates</p>
          }
          @case ('upToDate') {
            <p class="status ok">You are on the latest version.</p>
          }
          @case ('available') {
            <p>
              <strong>Version {{ updater.update()?.version }}</strong> is ready to install.
            </p>
          }
          @case ('error') {
            @if (!updater.sheetOpen()) {
              <p class="error">{{ updater.message() }}</p>
            }
          }
        }

        @if (updater.state() === 'available' && !updater.sheetOpen()) {
          <button type="button" (click)="updater.sheetOpen.set(true)">See what's new</button>
        } @else if (updater.state() !== 'checking' && updater.state() !== 'downloading' && updater.state() !== 'installing') {
          <button type="button" class="secondary" (click)="updater.check()">Check for updates</button>
        }
      </section>
    }

    <section class="card">
      <h2>Version history</h2>
      <p class="muted">See what changed in every release.</p>
      <a class="button secondary" routerLink="/changelog">Open version history</a>
    </section>

    <section class="card">
      <h2>Diagnostics</h2>
      <p class="muted">See the local event log and test sync with the server.</p>
      <a class="button secondary" routerLink="/sync-test">Open sync test</a>
    </section>
  `,
  styles: `
    :host {
      display: block;
      max-width: 36rem;
      margin: 0 auto;
    }
    section + section {
      margin-top: 1rem;
    }
    h2 {
      margin-bottom: 1rem;
    }
    .gap {
      height: 1.25rem;
    }
    small {
      display: block;
      color: var(--muted);
      font-size: 0.8rem;
    }
    .status {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }
    .status.ok {
      color: var(--good);
    }
    .notes {
      white-space: pre-wrap;
      font: inherit;
      color: var(--muted);
      margin: 0 0 1rem;
    }
    .bar {
      height: 8px;
      border-radius: 99px;
      background: var(--surface-2);
      overflow: hidden;
      margin-bottom: 0.75rem;
    }
    .bar span {
      display: block;
      height: 100%;
      background: var(--accent);
      border-radius: 99px;
      transform-origin: left;
      transition: transform 0.25s ease-out;
    }
    p + button,
    p + a,
    pre + button {
      margin-top: 0.25rem;
    }
    button + button {
      margin-left: 0.5rem;
    }
  `,
})
export class Settings implements OnInit {
  protected readonly theme = inject(ThemeService);
  protected readonly updater = inject(UpdaterService);
  protected readonly prefs = inject(PrefsService);
  protected readonly themes: SegmentOption<ThemeMode>[] = [
    { value: 'system', label: 'System' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ];

  ngOnInit(): void {
    void this.updater.loadVersion();
  }
}
