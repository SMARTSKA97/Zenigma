import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { UpdaterService } from '../core/updater.service';
import { Loader } from './loader';
import { Notes } from './notes';
import { Sheet } from './sheet';

/** The update flow: what's new, then a download with live progress, then hand-off to Android's installer. */
@Component({
  selector: 'app-update-sheet',
  imports: [DecimalPipe, Loader, Notes, Sheet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <app-sheet label="App update" [dismissible]="!busy()" (closed)="close()">
        @switch (updater.state()) {
          @case ('downloading') {
            <div class="center">
              <h2>Downloading update</h2>
              <p class="percent">{{ updater.progress() * 100 | number: '1.0-0' }}<small>%</small></p>
              <div class="wave" role="progressbar" aria-label="Download progress" aria-valuemin="0" aria-valuemax="100" [attr.aria-valuenow]="updater.progress() * 100 | number: '1.0-0'" [style.--p]="updater.progress()">
                <span class="done"></span>
                <span class="rest"></span>
              </div>
              <p class="muted size">{{ mb(updater.received()) }} of {{ mb(updater.total()) }} MB</p>
            </div>
          }
          @case ('installing') {
            <div class="center">
              <app-loader [size]="44" />
              <h2>Getting ready to install</h2>
              <p class="muted">Android will ask you to confirm in a moment.</p>
            </div>
          }
          @case ('needsPermission') {
            <h2>Allow installs from Zenigma</h2>
            <p class="muted">Android needs your permission before Zenigma can install its own updates. You only do this once.</p>
            <div class="actions">
              <button type="button" class="secondary" (click)="close()">Not now</button>
              <button type="button" (click)="updater.allowInstalls()">Open settings</button>
            </div>
          }
          @case ('error') {
            <h2>Update did not finish</h2>
            <p class="error">{{ updater.message() }}</p>
            <div class="actions">
              <button type="button" class="secondary" (click)="close()">Close</button>
              <button type="button" (click)="updater.install()">Try again</button>
            </div>
          }
          @default {
            <div class="head">
              <span class="badge" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 19h14" /></svg>
              </span>
              <div>
                <h2>Update available</h2>
                <p class="muted">Version {{ updater.currentVersion() }} to {{ updater.update()?.version }}</p>
              </div>
            </div>
            @if (updater.update()?.notes; as notes) {
              <div class="whats">
                <h3>What's new</h3>
                <app-notes [text]="notes" />
              </div>
            }
            <div class="actions">
              <button type="button" class="secondary" (click)="close()">Later</button>
              <button type="button" (click)="updater.install()">Update</button>
            </div>
          }
        }
      </app-sheet>
    }
  `,
  styles: `
    h2 {
      margin: 0 0 0.25rem;
      font-size: 1.4rem;
    }
    h3 {
      margin: 0 0 0.75rem;
      font-size: 1rem;
    }
    p {
      margin: 0;
    }
    .head {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.25rem;
    }
    .badge {
      width: 3.25rem;
      height: 3.25rem;
      flex: none;
      display: grid;
      place-items: center;
      border-radius: 18px;
      background: var(--accent-soft);
      color: var(--accent);
    }
    .badge svg {
      width: 26px;
      height: 26px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .whats {
      max-height: 38dvh;
      overflow: auto;
      margin-bottom: 1.25rem;
      padding: 1rem 1.1rem;
      border-radius: 20px;
      background: var(--surface-2);
    }
    .actions {
      display: flex;
      gap: 0.6rem;
      justify-content: flex-end;
      margin-top: 1.25rem;
    }
    .center {
      display: grid;
      justify-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0 0.75rem;
      text-align: center;
    }
    .percent {
      font-family: var(--font-display);
      font-size: 3.5rem;
      font-weight: 650;
      line-height: 1;
      letter-spacing: -0.04em;
      margin-top: 0.75rem;
    }
    .percent small {
      font-size: 1.5rem;
      margin-left: 0.15rem;
      color: var(--muted);
    }
    .size {
      font-size: 0.875rem;
      font-variant-numeric: tabular-nums;
    }

    /* Wavy progress: a moving wave for what is done, a calm line and end dot for what is left. */
    .wave {
      --wave: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='14' viewBox='0 0 24 14'%3E%3Cpath d='M0 7 Q6 0 12 7 T24 7' fill='none' stroke='black' stroke-width='3.5' stroke-linecap='round'/%3E%3C/svg%3E");
      position: relative;
      width: 100%;
      height: 14px;
      margin: 1.25rem 0 0.5rem;
    }
    .done {
      position: absolute;
      inset: 0 auto 0 0;
      width: calc(var(--p) * 100%);
      background: var(--accent);
      -webkit-mask: var(--wave) repeat-x 0 center / 24px 14px;
      mask: var(--wave) repeat-x 0 center / 24px 14px;
      animation: drift 0.9s linear infinite;
      transition: width 0.3s var(--ease);
    }
    .rest {
      position: absolute;
      top: 50%;
      right: 0;
      left: calc(var(--p) * 100% + 6px);
      height: 4px;
      transform: translateY(-50%);
      border-radius: 99px;
      background: var(--surface-2);
      transition: left 0.3s var(--ease);
    }
    .rest::after {
      content: '';
      position: absolute;
      top: 50%;
      right: 0;
      width: 4px;
      height: 4px;
      transform: translateY(-50%);
      border-radius: 50%;
      background: var(--accent);
    }
    @keyframes drift {
      to {
        -webkit-mask-position: 24px center;
        mask-position: 24px center;
      }
    }
    @media (max-width: 420px) {
      .actions button {
        flex: 1;
      }
    }
  `,
})
export class UpdateSheet {
  protected readonly updater = inject(UpdaterService);

  protected readonly busy = computed(() => ['downloading', 'installing'].includes(this.updater.state()));
  protected readonly visible = computed(
    () => this.updater.sheetOpen() && ['available', 'downloading', 'installing', 'needsPermission', 'error'].includes(this.updater.state()),
  );

  protected close(): void {
    this.updater.sheetOpen.set(false);
  }

  protected mb(bytes: number): string {
    return (bytes / 1_048_576).toFixed(1);
  }
}
