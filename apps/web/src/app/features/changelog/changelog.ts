import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { UpdaterService } from '../../core/updater.service';
import { parseNotes } from '../../shared/notes';

interface Entry {
  version: string;
  date: string | null;
  notes: string;
}
interface Section {
  title: string;
  items: string[];
}
interface Release extends Entry {
  sections: Section[];
  count: number;
}

/** Every version, newest first, as a timeline. The list is built from mobile/release-notes when the app is built. */
@Component({
  selector: 'app-changelog',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './changelog.html',
  styleUrl: './changelog.scss',
})
export class Changelog implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly updater = inject(UpdaterService);

  protected readonly entries = signal<Release[]>([]);
  /** The release that is open (the newest to begin with); tapping it again closes it. */
  protected readonly open = signal<string | null>(null);
  protected readonly loading = signal(true);
  protected readonly current = this.updater.currentVersion;

  async ngOnInit(): Promise<void> {
    void this.updater.loadVersion();
    try {
      const list = await firstValueFrom(this.http.get<Entry[]>('changelog.json'));
      const releases = (Array.isArray(list) ? list : []).map((e) => this.release(e));
      this.entries.set(releases);
      this.open.set(releases[0]?.version ?? null);
    } catch {
      this.entries.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  private release(e: Entry): Release {
    const sections: Section[] = [];
    for (const line of parseNotes(e.notes)) {
      if (line.kind === 'heading') sections.push({ title: line.text, items: [] });
      else {
        if (!sections.length) sections.push({ title: '', items: [] });
        sections[sections.length - 1].items.push(line.text);
      }
    }
    return { ...e, sections, count: sections.reduce((n, x) => n + x.items.length, 0) };
  }

  protected toggle(version: string): void {
    this.open.update((v) => (v === version ? null : version));
  }

  protected pretty(date: string): string {
    const d = new Date(`${date}T00:00:00`);
    return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
