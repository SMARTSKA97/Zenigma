import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

interface GoogleId {
  initialize(config: { client_id: string; callback: (response: { credential?: string }) => void; ux_mode?: string; auto_select?: boolean }): void;
  renderButton(el: HTMLElement, options: Record<string, unknown>): void;
}

const SCRIPT = 'https://accounts.google.com/gsi/client';

/**
 * Google sign-in with Google Identity Services. The server tells us its public client id (it is the same one it checks tokens
 * against), so there is nothing to rebuild when it is set. Not offered inside the Android app yet: that needs a native sign-in.
 */
@Injectable({ providedIn: 'root' })
export class GoogleService {
  private readonly http = inject(HttpClient);
  private clientId?: Promise<string | null>;
  private script?: Promise<GoogleId | null>;

  /** True in the Android app, where Google sign-in is not available yet. */
  readonly native = Capacitor.isNativePlatform();

  /** The public client id, or null when Google sign-in is not set up on the server. */
  available(): Promise<string | null> {
    if (this.native) return Promise.resolve(null);
    this.clientId ??= firstValueFrom(this.http.get<{ googleClientId: string | null }>(`${environment.apiBaseUrl}/auth/config`))
      .then((c) => c.googleClientId)
      .catch(() => {
        this.clientId = undefined; // asleep or offline: ask again next time
        return null;
      });
    return this.clientId;
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
