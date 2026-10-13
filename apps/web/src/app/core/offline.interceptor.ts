import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { ConnectionService } from './connection.service';

/** In offline mode no request leaves the device: calls fail the way they would with no connection, and every screen already copes with that. */
export const offlineInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiBaseUrl)) return next(req);
  if (inject(ConnectionService).offlineMode()) {
    return throwError(() => new HttpErrorResponse({ status: 0, statusText: 'Offline mode', url: req.url }));
  }
  return next(req);
};
