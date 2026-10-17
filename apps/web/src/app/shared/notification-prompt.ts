import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { ReminderService } from '../core/reminder.service';
import { Sheet } from './sheet';

/** Asks once, in plain words, whether to send notifications (daily reminder and streak alerts), before Android's own permission question. */
@Component({
  selector: 'app-notification-prompt',
  imports: [Sheet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notification-prompt.html',
  styleUrl: './notification-prompt.scss',
})
export class NotificationPrompt {
  protected readonly reminder = inject(ReminderService);
  private readonly router = inject(Router);
  private readonly open = signal(false);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  private readonly startedAt = Date.now();
  private checked = false;
  /** Never on top of a puzzle being played, or in the first moments after the app opens. */
  protected readonly visible = computed(() => this.open());

  constructor() {
    // Check a few seconds after start, on a calm screen (not in the middle of a game).
    setTimeout(() => void this.consider(), 6000);
  }

  private async consider(): Promise<void> {
    if (this.checked) return;
    if (/^\/(games|daily|mind|speed)\/[^/?]+/.test(this.url())) {
      setTimeout(() => void this.consider(), 15_000);
      return;
    }
    this.checked = true;
    if (await this.reminder.shouldAsk()) this.open.set(true);
  }

  protected async allow(): Promise<void> {
    this.open.set(false);
    this.reminder.markAsked();
    await this.reminder.setEnabled(true); // asks Android, then schedules the daily reminder (evening, changeable in Settings)
  }

  protected later(): void {
    this.open.set(false);
    this.reminder.markAsked();
  }
}
