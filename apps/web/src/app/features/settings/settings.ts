import { Component, computed, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { SyncService } from '../../core/sync.service';
import { ReminderService } from '../../core/reminder.service';
import { Loader } from '../../shared/loader';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { Switch } from '../../shared/switch';
import { InstallService } from '../../core/install.service';
import { HapticStrength, PrefsService } from '../../core/prefs.service';
import { ThemeMode, ThemeService } from '../../core/theme.service';
import { PracticeStore } from '../../games/puzzle/practice.store';
import { PRACTICE_TRACKS } from '../../games/catalog';
import { UpdaterService } from '../../core/updater.service';

@Component({
  selector: 'app-settings',
  imports: [RouterLink, Loader, Segmented, Switch],
  template: `
    <h1>Settings</h1>

    <a class="profile" routerLink="/account">
      @if (auth.user(); as user) {
        <span class="avatar" aria-hidden="true">{{ (user.displayName || user.email).charAt(0).toUpperCase() }}</span>
        <span class="pt">
          <strong>{{ user.displayName || user.email }}</strong>
          <small>
            {{ user.email }} ·
            @if (sync.syncing()) { Syncing } @else if (sync.pendingCount() > 0) { {{ sync.pendingCount() }} to sync } @else if (!sync.online()) { Offline } @else { Synced }
          </small>
        </span>
      } @else {
        <span class="avatar" aria-hidden="true">?</span>
        <span class="pt">
          <strong>Sign in or create account</strong>
          <small>Guest mode works offline. An account keeps streaks across devices.</small>
        </span>
      }
      <span class="chev" aria-hidden="true">›</span>
    </a>

    <h2 class="group">Appearance</h2>
    <section class="list">
      <div class="item stack">
        <span class="lead">Theme</span>
        <app-segmented label="Theme" [options]="themes" [value]="theme.mode()" (valueChange)="theme.set($event)" />
      </div>
      <div class="item stack">
        <span class="lead">Colour <small>New colours unlock as you clear practice levels ({{ solvedTotal() }} so far).</small></span>
        <div class="swatches" role="radiogroup" aria-label="Colour">
          @for (a of accents; track a.id) {
            <button type="button" class="sw-btn" role="radio" [attr.aria-checked]="prefs.accent() === a.id" [disabled]="solvedTotal() < a.need" [style.--c]="a.color" (click)="prefs.setAccent(a.id)">
              <i></i>
              <span>{{ a.name }}</span>
              @if (solvedTotal() < a.need) { <small>{{ a.need }} levels</small> }
            </button>
          }
        </div>
      </div>
      <div class="item">
        <app-switch [checked]="prefs.highContrast()" (checkedChange)="prefs.setHighContrast($event)">
          Colour-blind friendly
          <small>Orange and blue, plus letters on Queens regions.</small>
        </app-switch>
      </div>
      <div class="item">
        <app-switch [checked]="prefs.largeNumbers()" (checkedChange)="prefs.setLargeNumbers($event)">
          Larger numbers
          <small>Bigger digits and letters on the boards, easier to read.</small>
        </app-switch>
      </div>
      <div class="item">
        <app-switch [checked]="prefs.reduceMotion()" (checkedChange)="prefs.setReduceMotion($event)">
          Reduce motion
          <small>Turns off board animations and confetti.</small>
        </app-switch>
      </div>
      <div class="item">
        <app-switch [checked]="prefs.haptics()" (checkedChange)="prefs.setHaptics($event)">
          Vibration
          <small>Small taps as you play, and a pattern for mistakes and wins.</small>
        </app-switch>
      </div>
      @if (prefs.haptics()) {
        <div class="item stack">
          <span class="lead">Taps <small>A cell chosen, a number placed.</small></span>
          <app-segmented label="Tap strength" [options]="strengths" [value]="prefs.tapHaptics()" (valueChange)="prefs.setTapHaptics($event)" />
        </div>
        <div class="item stack">
          <span class="lead">Mistakes and wins <small>The pattern for a wrong move or a solved puzzle.</small></span>
          <app-segmented label="Alert strength" [options]="strengths" [value]="prefs.alertHaptics()" (valueChange)="prefs.setAlertHaptics($event)" />
        </div>
      }
    </section>

    @if (reminder.supported) {
      <h2 class="group">Reminders</h2>
      <section class="list">
        <div class="item">
          <app-switch [checked]="reminder.enabled()" (checkedChange)="reminder.setEnabled($event)">
            Daily reminder
            <small>One notification a day, from this phone. Nothing is sent to a server.</small>
          </app-switch>
        </div>
        @if (reminder.enabled()) {
          <label class="item time">
            <span class="lead">Time</span>
            <input type="time" [value]="reminder.timeValue()" (change)="reminder.setTime($any($event.target).value)" />
          </label>
        }
        @if (reminder.denied()) {
          <p class="item error">Notifications are blocked for Zenigma. Allow them in Android settings, under Apps, Zenigma, Notifications.</p>
        }
      </section>
    }

    @if (updater.supported) {
      <h2 class="group">App updates</h2>
      <section class="list">
        <div class="item stack">
          <span class="lead">Version {{ updater.currentVersion() ?? '-' }}</span>
          @switch (updater.state()) {
            @case ('checking') {
              <p class="status"><app-loader [size]="18" /> Checking for updates</p>
            }
            @case ('upToDate') {
              <p class="status ok">You are on the latest version.</p>
            }
            @case ('available') {
              <p><strong>Version {{ updater.update()?.version }}</strong> is ready to install.</p>
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
        </div>
      </section>
    }

    @if (install.available()) {
      <h2 class="group">Install</h2>
      <section class="list">
        <button type="button" class="item link" (click)="install.install()">
          <span class="ico">⬇</span>
          <span class="lead">Install Zenigma<small>Opens like an app and works offline.</small></span>
          <span class="chev">›</span>
        </button>
      </section>
    }

    <h2 class="group">Explore</h2>
    <section class="list">
      <a class="item link" routerLink="/stats"><span class="ico">📊</span><span class="lead">Streaks and stats</span><span class="chev">›</span></a>
      <a class="item link" routerLink="/badges"><span class="ico">🏅</span><span class="lead">Badges</span><span class="chev">›</span></a>
      <a class="item link" routerLink="/rules"><span class="ico">📖</span><span class="lead">How to play</span><span class="chev">›</span></a>
      <a class="item link" routerLink="/changelog"><span class="ico">🆕</span><span class="lead">Version history</span><span class="chev">›</span></a>
    </section>

    <h2 class="group">About</h2>
    <section class="list">
      <a class="item link" routerLink="/about"><span class="ico">✨</span><span class="lead">About Zenigma</span><span class="chev">›</span></a>
      <a class="item link" routerLink="/privacy"><span class="ico">🔒</span><span class="lead">Privacy policy</span><span class="chev">›</span></a>
      <a class="item link" routerLink="/sync-test"><span class="ico">🛠</span><span class="lead">Diagnostics</span><span class="chev">›</span></a>
    </section>
  `,
  styles: `
    :host {
      display: block;
      max-width: 36rem;
      margin: 0 auto;
      padding-bottom: 2rem;
    }
    .profile {
      display: flex;
      align-items: center;
      gap: 0.9rem;
      padding: 1rem;
      border-radius: var(--radius, 16px);
      background: var(--surface);
      border: 1px solid var(--border);
      color: var(--text);
      text-decoration: none;
    }
    .pt {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }
    .pt small {
      overflow-wrap: anywhere;
    }
    .avatar {
      flex: none;
      display: grid;
      place-items: center;
      width: 3.2rem;
      height: 3.2rem;
      border-radius: 50%;
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 1.3rem;
      color: var(--accent);
      background: var(--accent-soft);
    }
    .group {
      margin: 1.5rem 0.5rem 0.5rem;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .list {
      border-radius: var(--radius, 16px);
      background: var(--surface);
      border: 1px solid var(--border);
      overflow: hidden;
    }
    .item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.85rem 1rem;
      margin: 0;
    }
    .item + .item {
      border-top: 1px solid var(--border);
    }
    .item.stack {
      flex-direction: column;
      align-items: stretch;
      gap: 0.6rem;
    }
    .item app-switch {
      flex: 1;
    }
    .lead {
      flex: 1;
      font-weight: 500;
    }
    .link {
      color: var(--text);
      text-decoration: none;
    }
    :host button.item {
      width: 100%;
      min-height: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    .ico {
      width: 1.6rem;
      text-align: center;
    }
    .chev {
      color: var(--muted);
      font-size: 1.4rem;
      line-height: 1;
    }
    .swatches {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    :host .sw-btn {
      display: grid;
      justify-items: center;
      gap: 0.15rem;
      min-height: 0;
      width: 4.2rem;
      padding: 0.45rem 0.2rem;
      border: 2px solid var(--border);
      border-radius: 14px;
      background: var(--surface);
      box-shadow: none;
      color: var(--text);
      font: inherit;
      font-size: 0.78rem;
    }
    :host .sw-btn[aria-checked='true'] {
      border-color: var(--c);
    }
    :host .sw-btn:disabled {
      opacity: 0.5;
    }
    .sw-btn i {
      width: 1.6rem;
      height: 1.6rem;
      border-radius: 50%;
      background: var(--c);
    }
    .time input {
      width: auto;
    }
    small {
      display: block;
      color: var(--muted);
      font-size: 0.8rem;
      font-weight: 400;
    }
    .status {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      margin: 0;
    }
    .status.ok {
      color: var(--good);
    }
    .stack p {
      margin: 0;
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
  protected readonly install = inject(InstallService);
  private readonly practice = inject(PracticeStore);
  protected readonly accents = [
    { id: 'default', name: 'Ocean', color: '#2b3dae', need: 0 },
    { id: 'sunset', name: 'Sunset', color: '#c2410c', need: 10 },
    { id: 'forest', name: 'Forest', color: '#15803d', need: 100 },
    { id: 'orchid', name: 'Orchid', color: '#a21caf', need: 300 },
    { id: 'gold', name: 'Gold', color: '#a16207', need: 1000 },
  ];
  /** Practice levels cleared in all games on this device. */
  protected readonly solvedTotal = computed(() => PRACTICE_TRACKS.reduce((n, t) => n + this.practice.solvedLevels(t.track)().size, 0));
  protected readonly strengths: SegmentOption<HapticStrength>[] = [
    { value: 'off', label: 'Off' },
    { value: 'light', label: 'Light' },
    { value: 'strong', label: 'Strong' },
  ];
  protected readonly themes: SegmentOption<ThemeMode>[] = [
    { value: 'system', label: 'System' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ];

  ngOnInit(): void {
    for (const t of PRACTICE_TRACKS) void this.practice.load(t.track);
    void this.updater.loadVersion();
  }
}
