import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

const isAuthEndpoint = (url: string) => /\/auth\/(login|register|refresh|logout)$/.test(url);

/** Adds the bearer token to API calls and retries once after a refresh when the access token has expired. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiBaseUrl) || isAuthEndpoint(req.url)) return next(req);

  const auth = inject(AuthService);
  const withToken = (request: HttpRequest<unknown>) => {
    const token = auth.session()?.accessToken;
    return token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request;
  };

  return next(withToken(req)).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && auth.session()) {
        return from(auth.refresh()).pipe(
          switchMap((session) => (session ? next(withToken(req)) : throwError(() => error))),
        );
      }
      return throwError(() => error);
    }),
  );
};
