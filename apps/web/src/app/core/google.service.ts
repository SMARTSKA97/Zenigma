import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

interface GoogleId {
  initialize(config: { client_id: string; callback: (response: { credential?: string }) => void; ux_mode?: string; auto_select?: boolean }): void;
  renderButton(el: HTMLElement, options: Record<string, unknown>): void;
}

interface GoogleSignInPlugin {
  signIn(options: { serverClientId: string }): Promise<{ idToken: string; email?: string; name?: string }>;
}
const nativeGoogle = registerPlugin<GoogleSignInPlugin>('GoogleSignIn');

const SCRIPT = 'https://accounts.google.com/gsi/client';

/**
 * Google sign-in with Google Identity Services. The server tells us its public client id (it is the same one it checks tokens
 * against), so there is nothing to rebuild when it is set. Inside the Android app Google's web button cannot run, so the app asks
 * Android's own account picker instead; either way the server gets the same kind of ID token.
 */
@Injectable({ providedIn: 'root' })
export class GoogleService {
  private readonly http = inject(HttpClient);
  private script?: Promise<GoogleId | null>;

  /** True in the Android app, where sign-in goes through the phone's own account picker. */
  readonly native = Capacitor.isNativePlatform();

  private config?: Promise<{ googleClientId: string | null; email: boolean } | null>;

  private loadConfig(): Promise<{ googleClientId: string | null; email: boolean } | null> {
    this.config ??= firstValueFrom(this.http.get<{ googleClientId: string | null; email?: boolean }>(`${environment.apiBaseUrl}/auth/config`))
      .then((c) => ({ googleClientId: c.googleClientId, email: c.email === true }))
      .catch(() => {
        this.config = undefined; // asleep or offline: ask again next time
        return null;
      });
    return this.config;
  }

  /** The public client id, or null when Google sign-in is not set up on the server. */
  async available(): Promise<string | null> {
    return (await this.loadConfig())?.googleClientId ?? null;
  }

  /** Whether the server can send email (forgot password, confirming an address). Null when the server could not be reached. */
  async emailAvailable(): Promise<boolean | null> {
    const c = await this.loadConfig();
    return c ? c.email : null;
  }

  /**
   * Android only: opens the phone's Google account picker and returns the ID token. Null when the player backs out.
   * Throws an Error with a plain-language message when it cannot work (no account on the phone, or the build is not registered with Google).
   */
  async signInNative(): Promise<string | null> {
    const clientId = await this.available();
    if (!clientId) throw new Error('Google sign-in is not set up on this server yet.');
    try {
      return (await nativeGoogle.signIn({ serverClientId: clientId })).idToken;
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'CANCELLED') return null;
      if (code === 'NO_ACCOUNT') throw new Error('No Google account on this phone. Add one in your phone settings, then try again.');
      throw new Error('Google sign-in did not work on this install. Use your email for now.');
    }
  }

  /** Draws Google's own button in `el`. `onToken` gets the ID token when the player finishes. False when it cannot be shown. */
  async renderButton(el: HTMLElement, onToken: (idToken: string) => void, text: 'signin_with' | 'signup_with' | 'continue_with' = 'continue_with'): Promise<boolean> {
    const clientId = await this.available();
    if (!clientId) return false;
    const google = await this.load();
    if (!google) return false;
    google.initialize({ client_id: clientId, callback: (r) => r.credential && onToken(r.credential), ux_mode: 'popup' });
    google.renderButton(el, { type: 'standard', theme: 'outline', size: 'large', text, shape: 'pill', width: Math.min(320, el.clientWidth || 320) });
    return true;
  }

  private load(): Promise<GoogleId | null> {
    const existing = (window as unknown as { google?: { accounts?: { id?: GoogleId } } }).google?.accounts?.id;
    if (existing) return Promise.resolve(existing);
    this.script ??= new Promise<GoogleId | null>((resolve) => {
      const tag = document.createElement('script');
      tag.src = SCRIPT;
      tag.async = true;
      tag.onload = () => resolve((window as unknown as { google?: { accounts?: { id?: GoogleId } } }).google?.accounts?.id ?? null);
      tag.onerror = () => {
        this.script = undefined;
        resolve(null);
      };
      document.head.appendChild(tag);
    });
    return this.script;
  }
}
