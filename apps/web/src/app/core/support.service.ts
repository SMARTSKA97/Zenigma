import { computed, inject, Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';
import { UpdaterService } from './updater.service';

/** Where people can chip in for the running costs, and whether the Support sheet is open. */
@Injectable({ providedIn: 'root' })
export class SupportService {
  private readonly updater = inject(UpdaterService);
  readonly config = environment.support;
  readonly open = signal(false);
  /** Tips are for the website and sideloaded builds: Google Play wants its own billing for anything paid inside an app from the Play Store. */
  readonly canDonate = computed(
    () =>
      !this.updater.fromPlay() &&
      !!(this.config.upiId || this.config.sponsorsUrl || this.config.coffeeUrl || this.config.kofiUrl || this.config.paypalUrl),
  );
  readonly upiLink = `upi://pay?pa=${encodeURIComponent(environment.support.upiId)}&pn=${encodeURIComponent('Zenigma')}&cu=INR`;
}
