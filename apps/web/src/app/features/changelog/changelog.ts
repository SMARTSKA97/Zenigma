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
  template: `
    <header class="head">
      <a routerLink="/settings" class="back" aria-label="Back">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
      </a>
      <div>
        <h1>Version history</h1>
        <p class="muted">What changed in every release.</p>
      </div>
    </header>

    @if (loading()) {
      <div class="timeline" aria-busy="true">
        @for (n of [1, 2, 3]; track n) {
          <div class="skeleton block"></div>
        }
      </div>
    } @else if (!entries().length) {
      <section class="card"><p class="muted">The version history is not available right now.</p></section>
    } @else {
      <ol class="timeline">
        @for (e of entries(); track e.version; let first = $first) {
          <li [class.latest]="first" [style.--i]="$index">
            <span class="dot" aria-hidden="true"></span>
            <article class="card">
              <div class="top">
                <h2>{{ e.version }}</h2>
                @if (first) {
                  <span class="tag">Latest</span>
                }
                @if (e.version === current()) {
                  <span class="tag you">Installed</span>
                }
                @if (e.date) {
                  <time class="muted" [attr.datetime]="e.date">{{ pretty(e.date) }}</time>
                }
              </div>
              <app-notes [text]="e.notes" />
            </article>
          </li>
        }
      </ol>
    }
  `,
  styles: `
    :host {
      display: block;
      max-width: 40rem;
      margin: 0 auto;
    }
    .head {
      display: flex;
      align-items: center;
      gap: 0.9rem;
      margin-bottom: 1.5rem;
      h1,
      p {
        margin: 0;
      }
    }
    .back {
      display: grid;
      place-items: center;
      flex: none;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: var(--surface);
      border: 1px solid var(--border);
      color: var(--text);
      svg {
        width: 22px;
        height: 22px;
        fill: none;
        stroke: currentColor;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
    }
    .timeline {
      position: relative;
      list-style: none;
      margin: 0;
      padding: 0 0 0 2rem;
      display: grid;
      gap: 1rem;
    }
    /* The line the dots sit on. */
    .timeline::before {
      content: '';
      position: absolute;
      left: 0.55rem;
      top: 0.9rem;
      bottom: 0.9rem;
      width: 2px;
      border-radius: 2px;
      background: linear-gradient(var(--accent), var(--border) 30%);
    }
    li {
      position: relative;
      animation: rise 0.45s var(--ease) backwards;
      animation-delay: calc(var(--i) * 70ms);
    }
    .dot {
      position: absolute;
      left: -2rem;
      top: 1.25rem;
      width: 1.15rem;
      height: 1.15rem;
      border-radius: 50%;
      background: var(--bg);
      border: 2px solid var(--muted);
    }
    .latest .dot {
      border-color: var(--accent);
      background: var(--accent);
      box-shadow: 0 0 0 5px color-mix(in srgb, var(--accent) 22%, transparent);
    }
    .top {
      display: flex;
      align-items: baseline;
      flex-wrap: wrap;
      gap: 0.6rem;
      margin-bottom: 0.8rem;
      h2 {
        margin: 0;
        font-size: 1.3rem;
      }
      time {
        margin-left: auto;
        font-size: 0.82rem;
      }
    }
    .tag {
      padding: 0.1rem 0.6rem;
      border-radius: 99px;
      background: var(--accent);
      color: var(--accent-contrast);
      font-size: 0.72rem;
      font-weight: 600;
    }
    .tag.you {
      background: var(--accent-soft);
      color: var(--accent);
    }
    .block {
      height: 8rem;
      border-radius: var(--radius);
    }
  `,
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
