import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withViewTransitions } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { Capacitor } from '@capacitor/core';
import { routes } from './app.routes';
import { AuthService } from './core/auth.service';
import { authInterceptor } from './core/auth.interceptor';
import { IndexedDbStore } from './core/indexeddb-store';
import { LocalStore } from './core/local-store';
import { MemoryStore } from './core/memory-store';
import { SyncService } from './core/sync.service';
import { ThemeService } from './core/theme.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withViewTransitions()),
    provideHttpClient(withInterceptors([authInterceptor])),
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
      const auth = inject(AuthService);
      const sync = inject(SyncService);
      theme.apply();
      await auth.restore();
      void sync.init();
    }),
  ],
};
