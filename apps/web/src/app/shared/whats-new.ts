import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
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
  imports: [Notes, Sheet, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './whats-new.html',
  styleUrl: './whats-new.scss',
})
export class WhatsNew implements OnInit {
  protected readonly service = inject(WhatsNewService);

  ngOnInit(): void {
    void this.service.checkAfterUpdate();
  }
}
