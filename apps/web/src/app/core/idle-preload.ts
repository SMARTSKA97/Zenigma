import { Injectable } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { Observable, from, of, switchMap } from 'rxjs';

/** Wait for the app to settle, then fetch screens one after another when the browser is idle (never all at once during start-up). */
@Injectable({ providedIn: 'root' })
export class IdlePreload implements PreloadingStrategy {
  private queue: Promise<unknown> = new Promise((resolve) => setTimeout(resolve, 4000));

  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    if (!route.loadComponent && !route.loadChildren) return of(null);
    const turn = this.queue.then(
      () =>
        new Promise<void>((resolve) => {
          const go = () => resolve();
          if ('requestIdleCallback' in window) (window as Window & { requestIdleCallback: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback(go, { timeout: 2500 });
          else setTimeout(go, 200);
        }),
    );
    this.queue = turn;
    return from(turn).pipe(switchMap(() => load()));
  }
}
