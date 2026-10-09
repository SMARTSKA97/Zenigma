import { DatePipe, JsonPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { SyncService } from '../../core/sync.service';

/** Proves the phase-1 gate: save something with no connection, then watch it reach the server after sync. */
@Component({
  selector: 'app-sync-test',
  imports: [DatePipe, JsonPipe, RouterLink],
  template: `
    <h1>Sync test</h1>
    <p class="muted">
      Turn on airplane mode, save a note, then go back online. The note is stored on this device first and uploaded
      when you are signed in and connected.
    </p>

    @if (!auth.signedIn()) {
      <p class="card">
        You are playing as a guest. Notes are saved here and wait in the queue until you
        <a routerLink="/account">create an account or sign in</a>.
      </p>
    }

    <form class="row" (submit)="save($event)">
      <input name="note" [value]="note()" (input)="note.set($any($event.target).value)" placeholder="Write a note" />
      <button type="submit" [disabled]="!note().trim()">Save note</button>
      <button type="button" class="secondary" (click)="sync.sync()" [disabled]="sync.syncing() || !auth.signedIn()">
        {{ sync.syncing() ? 'Syncing…' : 'Sync now' }}
      </button>
    </form>

    @if (sync.lastError(); as error) {
      <p class="error">{{ error }}</p>
    }
    @if (sync.lastSyncedAt(); as at) {
      <p class="muted">Last synced {{ at | date: 'mediumTime' }}</p>
    }

    <ul class="events">
      @for (event of sync.events(); track event.id) {
        <li class="card">
          <div class="row">
            <strong>{{ event.kind }}</strong>
            <span class="badge" [class.pending]="event.pending === 1">
              {{ event.pending === 1 ? 'On this device only' : 'On the server' }}
            </span>
            <span class="muted">{{ event.clientCreatedAt | date: 'medium' }}</span>
          </div>
          <code>{{ event.payload | json }}</code>
        </li>
      } @empty {
        <li class="muted">No notes yet.</li>
      }
    </ul>
  `,
  styles: `
    .events {
      list-style: none;
      padding: 0;
      margin: 1.5rem 0 0;
      display: grid;
      gap: 0.75rem;
    }
    form input {
      flex: 1;
    }
    .badge {
      font-size: 0.75rem;
      padding: 0.1rem 0.5rem;
      border-radius: 999px;
      border: 1px solid var(--good);
      color: var(--good);
    }
    .badge.pending {
      border-color: var(--warn);
      color: var(--warn);
    }
    code {
      display: block;
      margin-top: 0.5rem;
      word-break: break-word;
    }
  `,
})
export class SyncTest {
  protected readonly sync = inject(SyncService);
  protected readonly auth = inject(AuthService);
  protected readonly note = signal('');

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    const text = this.note().trim();
    if (!text) return;
    await this.sync.record('note.created', { text });
    this.note.set('');
  }
}
