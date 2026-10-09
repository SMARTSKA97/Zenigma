import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { DeviceService, KEEP_ON_SIGN_OUT } from './device.service';
import { LocalStore } from './local-store';
import { AuthSession } from './types';

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

  async login(email: string, password: string): Promise<void> {
    const deviceId = await this.device.deviceId();
    const response = await firstValueFrom(
      this.http.post<AuthSession>(`${environment.apiBaseUrl}/auth/login`, { email, password, deviceId }),
    );
    await this.adopt(response);
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
