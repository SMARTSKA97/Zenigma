import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
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

  protected retry(): void {
    void this.conn.wake();
  }

  protected goOffline(): void {
    this.conn.setOffline(true);
  }
}
