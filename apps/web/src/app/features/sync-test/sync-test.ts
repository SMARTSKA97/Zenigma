import { DatePipe, JsonPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { SyncService } from '../../core/sync.service';

/** Proves the phase-1 gate: save something with no connection, then watch it reach the server after sync. */
@Component({
  selector: 'app-sync-test',
  imports: [DatePipe, JsonPipe, RouterLink],
  templateUrl: './sync-test.html',
  styleUrl: './sync-test.scss',
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
