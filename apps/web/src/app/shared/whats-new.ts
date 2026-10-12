import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, Injectable, OnInit, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { UpdaterService } from '../core/updater.service';
import { Notes } from './notes';
import { Sheet } from './sheet';

const SEEN_KEY = 'zenigma.seenVersion';

/**
 * Remembers which app version the person last saw and, after an update, loads the notes that shipped inside the app
 * (so it works offline).
 */
@Injectable({ providedIn: 'root' })
export class WhatsNewService {
  private readonly updater = inject(UpdaterService);
  private readonly http = inject(HttpClient);

  readonly open = signal(false);
  readonly version = signal('');
  readonly notes = signal('');

  async checkAfterUpdate(): Promise<void> {
    if (!this.updater.supported) return;
    await this.updater.loadVersion();
    const current = this.updater.currentVersion();
    if (!current) return;
    let seen: string | null = null;
    try {
      seen = localStorage.getItem(SEEN_KEY);
      localStorage.setItem(SEEN_KEY, current);
    } catch {
      return; // cannot remember, so never nag
    }
    if (seen === current) return;
    try {
      const text = await firstValueFrom(this.http.get('whats-new.md', { responseType: 'text' }));
      // The web fallback file starts with "<!doctype" when the server rewrites unknown paths.
      if (!text.trim() || text.trimStart().startsWith('<')) return;
      this.version.set(current);
      this.notes.set(text);
      this.open.set(true);
    } catch {
      /* no notes to show */
    }
  }
}

@Component({
  selector: 'app-whats-new',
  imports: [Notes, Sheet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (service.open()) {
      <app-sheet label="What's new" (closed)="service.open.set(false)">
        <div class="head">
          <span class="badge" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" /></svg>
          </span>
          <div>
            <h2>What's new</h2>
            <p class="muted">You are on version {{ service.version() }}</p>
          </div>
        </div>
        <div class="whats"><app-notes [text]="service.notes()" /></div>
        <button type="button" class="done" (click)="service.open.set(false)">Got it</button>
      </app-sheet>
    }
  `,
  styles: `
    h2 {
      margin: 0 0 0.25rem;
      font-size: 1.4rem;
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
      stroke-width: 1.8;
      stroke-linejoin: round;
    }
    .whats {
      max-height: 42dvh;
      overflow: auto;
      padding: 1rem 1.1rem;
      border-radius: 20px;
      background: var(--surface-2);
    }
    .done {
      width: 100%;
      margin-top: 1.25rem;
    }
  `,
})
export class WhatsNew implements OnInit {
  protected readonly service = inject(WhatsNewService);

  ngOnInit(): void {
    void this.service.checkAfterUpdate();
  }
}
