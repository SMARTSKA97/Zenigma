import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { InstallService } from '../core/install.service';
import { Sheet } from './sheet';

/**
 * Add Zenigma to the Home Screen of an iPhone or iPad, and keep it up to date: a picture for every step.
 * The pictures are drawn here (not photographs), so they follow the light and dark theme and never go stale.
 */
@Component({
  selector: 'app-ios-guide',
  imports: [Sheet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-sheet label="Add Zenigma to your Home Screen" (closed)="closed.emit()">
      <div class="tabs" role="tablist">
        <button type="button" role="tab" [attr.aria-selected]="tab() === 'install'" [class.on]="tab() === 'install'" (click)="tab.set('install')">Install</button>
        <button type="button" role="tab" [attr.aria-selected]="tab() === 'update'" [class.on]="tab() === 'update'" (click)="tab.set('update')">Update</button>
      </div>

      @if (tab() === 'install') {
        <ol class="steps">
          <li>
            <svg viewBox="0 0 220 120" aria-hidden="true">
              <rect x="1" y="1" width="218" height="118" rx="14" class="scr" />
              <rect x="14" y="12" width="192" height="24" rx="12" class="bar" />
              <text x="110" y="29" text-anchor="middle" class="t">zenigma.app</text>
              <rect x="1" y="84" width="218" height="35" rx="0 0 14 14" class="tool" />
              <path d="M30 100l6 6 10-12" class="ic" />
              <g class="hot"><circle cx="110" cy="101" r="15" /><path d="M110 108V92m-6 5 6-6 6 6M103 98h-3v10h20V98h-3" class="ic2" /></g>
              <path d="M180 94h18v14h-18z" class="ic" />
            </svg>
            <div><strong>1. Open in Safari</strong><p>Go to the Zenigma website in <b>Safari</b> (other iPhone browsers can add it too, from their Share menu).</p></div>
          </li>
          <li>
            <svg viewBox="0 0 220 120" aria-hidden="true">
              <rect x="1" y="1" width="218" height="118" rx="14" class="scr" />
              <rect x="1" y="84" width="218" height="35" class="tool" />
              <g class="hot"><circle cx="110" cy="101" r="16" /><path d="M110 108V92m-6 5 6-6 6 6M103 98h-3v10h20V98h-3" class="ic2" /></g>
              <path d="M180 92v18M171 101h18" class="ic" opacity=".0" />
            </svg>
            <div><strong>2. Tap Share</strong><p>The square with an arrow pointing up, at the bottom (on iPad, at the top).</p></div>
          </li>
          <li>
            <svg viewBox="0 0 220 120" aria-hidden="true">
              <rect x="1" y="1" width="218" height="118" rx="14" class="scr" />
              <rect x="1" y="26" width="218" height="93" rx="14" class="sheetbg" />
              <rect x="14" y="36" width="192" height="18" rx="6" class="row" />
              <rect x="14" y="58" width="192" height="18" rx="6" class="row" />
              <g class="hot2"><rect x="14" y="80" width="192" height="20" rx="6" /><text x="26" y="94" class="t2">Add to Home Screen</text><rect x="178" y="84" width="14" height="14" rx="3" class="plus" /><path d="M185 87v8M181 91h8" class="ic3" /></g>
            </svg>
            <div><strong>3. Add to Home Screen</strong><p>Scroll the list down if you cannot see it, tap <b>Add to Home Screen</b>, then <b>Add</b> at the top right.</p></div>
          </li>
          <li>
            <svg viewBox="0 0 220 120" aria-hidden="true">
              <rect x="1" y="1" width="218" height="118" rx="14" class="scr" />
              @for (x of [24, 66, 108]; track x) {
                <rect [attr.x]="x" y="22" width="32" height="32" rx="8" class="app" />
              }
              <g class="hot"><rect x="150" y="20" width="36" height="36" rx="9" /></g>
              <rect x="152" y="22" width="32" height="32" rx="8" class="mark" />
              <text x="168" y="70" text-anchor="middle" class="t">Zenigma</text>
            </svg>
            <div><strong>4. Open it from your Home Screen</strong><p>Always start Zenigma from this icon: it opens full screen, works offline and keeps your streak.</p></div>
          </li>
        </ol>
      } @else {
        <ol class="steps">
          <li>
            <svg viewBox="0 0 220 120" aria-hidden="true">
              <rect x="1" y="1" width="218" height="118" rx="14" class="scr" />
              <rect x="50" y="20" width="120" height="60" rx="10" class="sheetbg" />
              <text x="110" y="44" text-anchor="middle" class="t2">Update ready</text>
              <g class="hot2"><rect x="76" y="54" width="68" height="18" rx="9" /><text x="110" y="67" text-anchor="middle" class="t2">Reload</text></g>
            </svg>
            <div><strong>Updates are automatic</strong><p>There is nothing to download. When you open Zenigma with internet, the new version is fetched quietly. Tap <b>Reload</b> when "Update ready" appears.</p></div>
          </li>
          <li>
            <svg viewBox="0 0 220 120" aria-hidden="true">
              <rect x="1" y="1" width="218" height="118" rx="14" class="scr" />
              <rect x="70" y="16" width="80" height="88" rx="10" class="sheetbg" />
              <path d="M110 98V50m-8 10 8-10 8 10" class="ic" />
            </svg>
            <div><strong>Not showing up?</strong><p>Swipe up from the bottom edge and pause to see your open apps, swipe Zenigma up to close it, then open it again from the Home Screen with internet on.</p></div>
          </li>
        </ol>
      }
    </app-sheet>
  `,
  styles: `
    .tabs {
      display: flex;
      gap: 0.4rem;
      margin-bottom: 1rem;
    }
    .tabs button {
      flex: 1;
      min-height: 0;
      padding: 0.5rem;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: transparent;
      color: var(--text);
      font: inherit;
      font-weight: 600;
      box-shadow: none;
    }
    .tabs button.on {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
    }
    .steps {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 1.1rem;
    }
    li {
      display: grid;
      gap: 0.5rem;
    }
    li p {
      margin: 0.15rem 0 0;
      color: var(--muted);
      font-size: 0.88rem;
    }
    svg {
      width: 100%;
      max-width: 22rem;
      justify-self: center;
    }
    .scr {
      fill: var(--surface-2);
      stroke: var(--border);
    }
    .bar,
    .row,
    .app {
      fill: var(--surface);
    }
    .tool,
    .sheetbg {
      fill: var(--surface);
      stroke: var(--border);
    }
    .t,
    .t2 {
      fill: var(--text);
      font: 600 9px system-ui, sans-serif;
    }
    .t2 {
      font-size: 10px;
    }
    .ic,
    .ic2,
    .ic3 {
      fill: none;
      stroke: var(--muted);
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .hot circle,
    .hot rect {
      fill: color-mix(in srgb, var(--accent) 22%, transparent);
      stroke: var(--accent);
      stroke-width: 2;
    }
    .hot .ic2 {
      stroke: var(--accent);
    }
    .hot2 rect:first-child {
      fill: color-mix(in srgb, var(--accent) 22%, transparent);
      stroke: var(--accent);
      stroke-width: 2;
    }
    .plus {
      fill: var(--accent);
    }
    .ic3 {
      stroke: #fff;
      stroke-width: 1.6;
    }
    .mark {
      fill: var(--accent);
    }
  `,
})
export class IosGuide {
  protected readonly install = inject(InstallService);
  readonly closed = output<void>();
  readonly start = input<'install' | 'update'>('install');
  protected readonly tab = signal<'install' | 'update'>('install');

  constructor() {
    queueMicrotask(() => this.tab.set(this.start()));
  }
}
