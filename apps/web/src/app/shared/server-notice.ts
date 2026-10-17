import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { ConnectionService } from '../core/connection.service';
import { Loader } from './loader';

/** A slim notice under the header while the server wakes up. Everything that works offline stays usable. */
@Component({
  selector: 'app-server-notice',
  imports: [Loader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './server-notice.html',
  styleUrl: './server-notice.scss',
})
export class ServerNotice {
  protected readonly conn = inject(ConnectionService);
  private readonly router = inject(Router);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  /** Screens that cannot do anything without the server. While it wakes they get a full cover, so nobody taps around a half-loaded screen. */
  protected readonly blocking = computed(
    () => this.conn.notice() === 'warming' && /^\/(daily|challenges|ranks|stats|account)(\/|\?|$)/.test(this.url()),
  );

  protected retry(): void {
    void this.conn.wake();
  }

  protected leave(): void {
    void this.router.navigateByUrl('/');
  }

  protected goOffline(): void {
    this.conn.setOffline(true);
  }
}
