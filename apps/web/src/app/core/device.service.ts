import { inject, Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { LocalStore } from './local-store';

const DEVICE_ID_KEY = 'deviceId';

/** Stable random id for this install; lets the server tell devices apart (and, later, enforce the daily lease). */
@Injectable({ providedIn: 'root' })
export class DeviceService {
  private readonly store = inject(LocalStore);
  private cached?: Promise<string>;

  readonly platform: string = Capacitor.getPlatform();

  deviceId(): Promise<string> {
    this.cached ??= (async () => {
      const existing = await this.store.getMeta<string>(DEVICE_ID_KEY);
      if (existing) return existing;
      const created = crypto.randomUUID();
      await this.store.setMeta(DEVICE_ID_KEY, created);
      return created;
    })();
    return this.cached;
  }
}

/** Meta keys that survive a sign-out: the device identity belongs to the install, not the account. */
export const KEEP_ON_SIGN_OUT = [DEVICE_ID_KEY];
