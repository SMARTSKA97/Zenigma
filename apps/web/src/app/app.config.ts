import {
  ApplicationConfig,
  ErrorHandler,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withInMemoryScrolling, withPreloading } from '@angular/router';
import { IdlePreload } from './core/idle-preload';
import { provideServiceWorker } from '@angular/service-worker';
import { Capacitor } from '@capacitor/core';
import { ReportingErrorHandler } from './core/error-reporter';
import { routes } from './app.routes';
import { AuthService } from './core/auth.service';
import { authInterceptor } from './core/auth.interceptor';
import { offlineInterceptor } from './core/offline.interceptor';
import { ConnectionService } from './core/connection.service';
import { IndexedDbStore } from './core/indexeddb-store';
import { LocalStore } from './core/local-store';
import { MemoryStore } from './core/memory-store';
import { SyncService } from './core/sync.service';
import { PrefsService } from './core/prefs.service';
import { ThemeService } from './core/theme.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: ErrorHandler, useClass: ReportingErrorHandler },
    // Screens are fetched in the background, one at a time, once the app is idle, so moving between them never waits on the network and
    // start-up is not crowded. There are no view transitions: they freeze the page for taps while they run, which felt like lag.
    provideRouter(routes, withPreloading(IdlePreload), withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    provideHttpClient(withInterceptors([offlineInterceptor, authInterceptor])),
    {
      provide: LocalStore,
      useFactory: () => (typeof indexedDB === 'undefined' ? new MemoryStore() : new IndexedDbStore()),
    },
    // The service worker caches the web build for offline use. The Android app already ships its files, so it skips it.
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode() && !Capacitor.isNativePlatform(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    provideAppInitializer(async () => {
      // inject() only works before the first await, so resolve everything up front.
      const theme = inject(ThemeService);
      const prefs = inject(PrefsService);
      const auth = inject(AuthService);
      const sync = inject(SyncService);
      const connection = inject(ConnectionService);
      theme.apply();
      prefs.apply();
      await auth.restore();
      await sync.init();
      // The app no longer wakes the server on every start: a sleeping free host then stays asleep for players who only
      // play. Leaderboards, the daily and sign-in wake it when opened; waiting results go out with that, or here when
      // a signed-in player has results that have waited a day or have piled up.
      if (await sync.dueAtStart()) void connection.wake();
    }),
  ],
};
