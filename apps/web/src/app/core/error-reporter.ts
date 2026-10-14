import { ErrorHandler, inject, Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { environment } from '../../environments/environment';
import { ConnectionService } from './connection.service';
import { PrefsService } from './prefs.service';

/**
 * Logs every uncaught error to the console as before, and, unless the person turned it off (or offline mode is on), sends a
 * small crash report to our own API: the message, a short stack, the screen and the platform. No account or device id is
 * attached and nothing goes to a third party. At most five reports are sent per visit, and the same message once.
 */
@Injectable()
export class ReportingErrorHandler implements ErrorHandler {
  private readonly prefs = inject(PrefsService);
  private readonly conn = inject(ConnectionService);
  private readonly sent = new Set<string>();

  handleError(error: unknown): void {
    console.error(error);
    try {
      if (!this.prefs.crashReports() || this.conn.offlineMode() || this.sent.size >= 5) return;
      const err = error as { message?: unknown; stack?: unknown } | string | null;
      const message = String(typeof err === 'string' ? err : (err?.message ?? err ?? 'unknown')).slice(0, 300);
      if (this.sent.has(message)) return;
      this.sent.add(message);
      const stack = typeof err === 'object' && err && typeof err.stack === 'string' ? err.stack.slice(0, 800) : '';
      void fetch(`${environment.apiBaseUrl}/telemetry/error`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, stack, route: location.pathname, platform: Capacitor.getPlatform() }),
        keepalive: true,
      }).catch(() => undefined);
    } catch {
      /* reporting must never throw */
    }
  }
}
