import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export const AGE_GROUPS = ['18-24', '25-34', '35-44', '45-54', '55+'] as const;
export const GENDERS = [
  { id: 'female', label: 'Woman' },
  { id: 'male', label: 'Man' },
  { id: 'other', label: 'Another way' },
] as const;

export interface Profile {
  email: string;
  displayName: string | null;
  hasPassword: boolean;
  providers: string[];
  ageGroup: string | null;
  gender: string | null;
  shareCohort: boolean;
  hideName: boolean;
}

export type ProfilePatch = Partial<{
  displayName: string;
  ageGroup: string;
  gender: string;
  shareCohort: boolean;
  hideName: boolean;
  clearAgeGroup: boolean;
  clearGender: boolean;
}>;

/** The signed-in player's details and what they let Zenigma do with them. Lives on the server; empty for guests. */
@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  readonly profile = signal<Profile | null>(null);
  readonly loading = signal(false);
  readonly google = computed(() => this.profile()?.providers.includes('google') ?? false);

  async load(): Promise<void> {
    if (!this.auth.signedIn()) {
      this.profile.set(null);
      return;
    }
    this.loading.set(true);
    try {
      this.profile.set(await firstValueFrom(this.http.get<Profile>(`${environment.apiBaseUrl}/profile`)));
    } catch {
      /* offline or asleep: the last copy stays */
    } finally {
      this.loading.set(false);
    }
  }

  async save(patch: ProfilePatch): Promise<void> {
    const next = await firstValueFrom(this.http.put<Profile>(`${environment.apiBaseUrl}/profile`, patch));
    this.profile.set(next);
    if (patch.displayName !== undefined) await this.auth.rename(next.displayName);
  }

  async setPassword(currentPassword: string | null, newPassword: string): Promise<void> {
    await firstValueFrom(this.http.post(`${environment.apiBaseUrl}/profile/password`, { currentPassword, newPassword }));
    await this.load();
  }

  async linkGoogle(idToken: string): Promise<void> {
    await firstValueFrom(this.http.post(`${environment.apiBaseUrl}/profile/providers/google`, { idToken }));
    await this.load();
  }

  async unlinkGoogle(): Promise<void> {
    await firstValueFrom(this.http.delete(`${environment.apiBaseUrl}/profile/providers/google`));
    await this.load();
  }
}
