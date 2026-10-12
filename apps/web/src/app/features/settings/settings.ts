import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { SyncService } from '../../core/sync.service';
import { ReminderService } from '../../core/reminder.service';
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

    <section class="card account">
      @if (auth.user(); as user) {
        <div class="who">
          <span class="avatar" aria-hidden="true">{{ (user.displayName || user.email).charAt(0).toUpperCase() }}</span>
          <div>
            <h2>{{ user.displayName || user.email }}</h2>
            <p class="muted">
              {{ user.email }} ·
              @if (sync.syncing()) { Syncing } @else if (sync.pendingCount() > 0) { {{ sync.pendingCount() }} to sync } @else if (!sync.online()) { Offline } @else { Synced }
            </p>
          </div>
        </div>
        <div class="row">
          <a class="button secondary" routerLink="/account">Manage account</a>
          <a class="button secondary" routerLink="/stats">Streaks and stats</a>
        </div>
      } @else {
        <h2>Account</h2>
        <p class="muted">Guest mode works offline. An account keeps your streaks and history across devices and puts you on leaderboards.</p>
        <a class="button" routerLink="/account">Sign in or create account</a>
      }
    </section>

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

    @if (reminder.supported) {
      <section class="card">
        <h2>Daily reminder</h2>
        <app-switch [checked]="reminder.enabled()" (checkedChange)="reminder.setEnabled($event)">
          Remind me to play
          <small>One notification a day, from this phone. Nothing is sent to a server.</small>
        </app-switch>
        @if (reminder.enabled()) {
          <label class="time">
            Time
            <input type="time" [value]="reminder.timeValue()" (change)="reminder.setTime($any($event.target).value)" />
          </label>
        }
        @if (reminder.denied()) {
          <p class="error">Notifications are blocked for Zenigma. Allow them in Android settings, under Apps, Zenigma, Notifications.</p>
        }
      </section>
    }

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
      <h2>About</h2>
      <p class="muted">What Zenigma is, who makes it, and how your data is handled.</p>
      <div class="row">
        <a class="button secondary" routerLink="/about">About Zenigma</a>
        <a class="button secondary" routerLink="/privacy">Privacy policy</a>
      </div>
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
    .who {
      display: flex;
      align-items: center;
      gap: 0.9rem;
      margin-bottom: 1rem;
    }
    .who h2 {
      margin: 0;
    }
    .who p {
      margin: 0;
      font-size: 0.85rem;
      overflow-wrap: anywhere;
    }
    .avatar {
      flex: none;
      display: grid;
      place-items: center;
      width: 3rem;
      height: 3rem;
      border-radius: 50%;
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 1.25rem;
      color: var(--accent);
      background: var(--accent-soft);
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .time {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 1rem;
      font-weight: 600;
    }
    .time input {
      width: auto;
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
  protected readonly auth = inject(AuthService);
  protected readonly sync = inject(SyncService);
  protected readonly reminder = inject(ReminderService);
  protected readonly themes: SegmentOption<ThemeMode>[] = [
    { value: 'system', label: 'System' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ];

  ngOnInit(): void {
    void this.updater.loadVersion();
  }
}
