import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { UpdaterService } from '../../core/updater.service';
import { Notes } from '../../shared/notes';

interface Entry {
  version: string;
  date: string | null;
  notes: string;
}

/** Every version, newest first, as a timeline. The list is built from mobile/release-notes when the app is built. */
@Component({
  selector: 'app-changelog',
  imports: [Notes, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './changelog.html',
  styleUrl: './changelog.scss',
})
export class Changelog implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly updater = inject(UpdaterService);

  protected readonly entries = signal<Entry[]>([]);
  protected readonly loading = signal(true);
  protected readonly current = this.updater.currentVersion;

  async ngOnInit(): Promise<void> {
    void this.updater.loadVersion();
    try {
      const list = await firstValueFrom(this.http.get<Entry[]>('changelog.json'));
      this.entries.set(Array.isArray(list) ? list : []);
    } catch {
      this.entries.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  protected pretty(date: string): string {
    const d = new Date(`${date}T00:00:00`);
    return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
