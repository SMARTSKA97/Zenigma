import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { DeviceService, KEEP_ON_SIGN_OUT } from './device.service';
import { LocalStore } from './local-store';
import { AuthSession } from './types';

/** A device that holds a live session for the account. */
export interface DeviceInfo {
  id: string;
  name: string;
  lastUsedAt: string;
  current: boolean;
}

/** The account is already signed in on as many devices as it may have; the player picks one to sign out. */
export class DeviceLimitError extends Error {
  constructor(
    readonly limit: number,
    readonly devices: DeviceInfo[],
  ) {
    super('device-limit');
  }
}

const asLimit = (error: unknown): unknown =>
  error instanceof HttpErrorResponse && error.status === 409 && error.error?.code === 'device-limit'
    ? new DeviceLimitError(Number(error.error.limit) || 1, (error.error.devices ?? []) as DeviceInfo[])
    : error;

const SESSION_KEY = 'auth';
const OWNER_KEY = 'ownerId';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly store = inject(LocalStore);
  private readonly device = inject(DeviceService);
  private refreshing?: Promise<AuthSession | null>;

  readonly session = signal<AuthSession | null>(null);
  readonly user = computed(() => this.session()?.user ?? null);
  readonly signedIn = computed(() => this.session() !== null);
  /** True when the server rejected our refresh token: the user has to sign in again. Local data is kept. */
  readonly sessionExpired = signal(false);

  async restore(): Promise<void> {
    this.session.set((await this.store.getMeta<AuthSession>(SESSION_KEY)) ?? null);
  }

  async register(email: string, password: string, displayName: string): Promise<void> {
    const deviceId = await this.device.deviceId();
    const response = await firstValueFrom(
      this.http.post<AuthSession>(`${environment.apiBaseUrl}/auth/register`, {
        email,
        password,
        displayName: displayName || null,
        deviceId,
      }),
    );
    await this.adopt(response);
  }

  /** Throws DeviceLimitError when the account is full; call again with the id of a device to sign out. */
  async login(email: string, password: string, replaceDeviceId?: string): Promise<void> {
    const deviceId = await this.device.deviceId();
    try {
      const response = await firstValueFrom(
        this.http.post<AuthSession>(`${environment.apiBaseUrl}/auth/login`, { email, password, deviceId, replaceDeviceId }),
      );
      await this.adopt(response);
    } catch (error) {
      throw asLimit(error);
    }
  }

  /** Emails a reset code. The server answers the same for any address, so this never says whether an account exists. */
  async forgotPassword(email: string): Promise<void> {
    await firstValueFrom(this.http.post(`${environment.apiBaseUrl}/auth/forgot`, { email }));
  }

  /** Sets a new password with the emailed code and signs in. Every other session of the account ends. */
  async resetPassword(email: string, code: string, newPassword: string): Promise<void> {
    const deviceId = await this.device.deviceId();
    const response = await firstValueFrom(
      this.http.post<AuthSession>(`${environment.apiBaseUrl}/auth/reset`, { email, code, newPassword, deviceId }),
    );
    await this.adopt(response);
  }

  /** Emails a code that confirms the signed-in account's address. */
  async sendVerification(): Promise<void> {
    await firstValueFrom(this.http.post(`${environment.apiBaseUrl}/auth/verify/send`, {}));
  }

  /** Checks the emailed code; on success the stored session shows the address as verified. */
  async verifyEmail(code: string): Promise<void> {
    await firstValueFrom(this.http.post(`${environment.apiBaseUrl}/auth/verify`, { code }));
    const current = this.session();
    if (!current) return;
    const next = { ...current, user: { ...current.user, emailVerified: true } };
    await this.store.setMeta(SESSION_KEY, next);
    this.session.set(next);
  }

  /** Signs in (or creates the account) with a Google ID token from Google Identity Services. */
  async loginWithGoogle(idToken: string, replaceDeviceId?: string): Promise<void> {
    const deviceId = await this.device.deviceId();
    try {
      const response = await firstValueFrom(this.http.post<AuthSession>(`${environment.apiBaseUrl}/auth/google`, { idToken, deviceId, replaceDeviceId }));
      await this.adopt(response);
    } catch (error) {
      throw asLimit(error);
    }
  }

  /** The devices this account is signed in on, and how many it may have. */
  async devices(): Promise<{ limit: number; devices: DeviceInfo[] }> {
    const current = await this.device.deviceId();
    return firstValueFrom(this.http.get<{ limit: number; devices: DeviceInfo[] }>(`${environment.apiBaseUrl}/auth/devices`, { params: { current } }));
  }

  /** Signs one device out. If it is this one, this device is signed out here too. */
  async signOutDevice(id: string): Promise<void> {
    await firstValueFrom(this.http.post(`${environment.apiBaseUrl}/auth/devices/${id}/signout`, null));
    if (id === (await this.device.deviceId())) await this.logout();
  }

  /** Signs out every other device, or (with keepThis false) every device including this one. */
  async signOutDevices(keepThis: boolean): Promise<void> {
    const keep = keepThis ? await this.device.deviceId() : undefined;
    await firstValueFrom(this.http.post(`${environment.apiBaseUrl}/auth/devices/signout-all`, null, { params: keep ? { keep } : {} }));
    if (!keepThis) await this.logout();
  }

  /** Keeps the stored session's name in step after the profile changes it. */
  async rename(displayName: string | null): Promise<void> {
    const current = this.session();
    if (!current) return;
    const next = { ...current, user: { ...current.user, displayName } };
    await this.store.setMeta(SESSION_KEY, next);
    this.session.set(next);
  }

  /**
   * Swaps the refresh token for a new session. Only a definite "no" from the server ends the session;
   * being offline or the API waking up just returns null and leaves the session alone.
   */
  refresh(): Promise<AuthSession | null> {
    this.refreshing ??= this.doRefresh().finally(() => (this.refreshing = undefined));
    return this.refreshing;
  }

  async logout(): Promise<void> {
    const current = this.session();
    if (current) {
      // Best effort: revoke the refresh token if we can reach the server.
      try {
        await firstValueFrom(
          this.http.post(`${environment.apiBaseUrl}/auth/logout`, { refreshToken: current.refreshToken }),
        );
      } catch {
        /* offline: the token simply expires on the server */
      }
    }
    await this.store.reset(KEEP_ON_SIGN_OUT);
    this.session.set(null);
    this.sessionExpired.set(false);
  }

  /** Deletes the account on the server (it needs the password, or just a confirmation for Google-only accounts), then clears this device. Throws if refused. */
  async deleteAccount(password: string | null): Promise<void> {
    await firstValueFrom(this.http.post(`${environment.apiBaseUrl}/auth/delete-account`, password === null ? { confirm: true } : { password }));
    await this.store.reset(KEEP_ON_SIGN_OUT);
    this.session.set(null);
    this.sessionExpired.set(false);
  }

  private async doRefresh(): Promise<AuthSession | null> {
    const current = this.session();
    if (!current) return null;
    try {
      const deviceId = await this.device.deviceId();
      const response = await firstValueFrom(
        this.http.post<AuthSession>(`${environment.apiBaseUrl}/auth/refresh`, {
          refreshToken: current.refreshToken,
          deviceId,
        }),
      );
      await this.adopt(response);
      return response;
    } catch (error) {
      if (error instanceof HttpErrorResponse && (error.status === 400 || error.status === 401)) {
        await this.store.deleteMeta(SESSION_KEY);
        this.session.set(null);
        this.sessionExpired.set(true);
      }
      return null;
    }
  }

  /**
   * Stores the new session. Data created as a guest is adopted by the account that signs in, but data
   * owned by a different account is wiped first so it can never be uploaded under the wrong user.
   */
  private async adopt(response: AuthSession): Promise<void> {
    const owner = await this.store.getMeta<string>(OWNER_KEY);
    if (owner && owner !== response.user.id) {
      await this.store.reset(KEEP_ON_SIGN_OUT);
    }
    await this.store.setMeta(OWNER_KEY, response.user.id);
    await this.store.setMeta(SESSION_KEY, response);
    this.session.set(response);
    this.sessionExpired.set(false);
  }
}
