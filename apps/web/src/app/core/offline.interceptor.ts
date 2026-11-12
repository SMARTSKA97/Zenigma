import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { ConnectionService } from './connection.service';

/**
 * The one gate every API call goes through.
 * Offline mode, or a practice screen being open: no request leaves the device; calls fail the way they would with no connection, and every screen already copes with that.
 * Otherwise a call made while the server may be asleep first wakes it (one wake-up for all of them, with the loading cover), so screens
 * never fire requests at a sleeping host, and the app itself never wakes the server just by being opened.
 */
export const offlineInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiBaseUrl)) return next(req);
  const conn = inject(ConnectionService);
  const failure = () => throwError(() => new HttpErrorResponse({ status: 0, statusText: conn.offlineMode() ? 'Offline mode' : conn.paused() ? 'Practice (no connection used)' : 'Server unreachable', url: req.url }));
  if (conn.offlineMode() || (conn.paused() && !req.url.endsWith('/health'))) return failure();
  // The service worker never needs to see an API call (nothing is cached there): ngsw-bypass keeps it from turning a failure into a fake 504.
  const send = () => next(req.params.has('ngsw-bypass') ? req : req.clone({ setParams: { 'ngsw-bypass': 'true' } }));
  if (conn.server() === 'ready' || req.url.endsWith('/health')) return send();
  return from(conn.wake()).pipe(switchMap((up) => (up ? send() : failure())));
};
