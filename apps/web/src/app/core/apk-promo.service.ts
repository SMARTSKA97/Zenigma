import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { isNewer } from './updater.service';

interface Release {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  assets: { name: string; browser_download_url: string; size: number }[];
}

export interface ApkInfo {
  version: string;
  url: string;
  sizeMb: number | null;
}

const TAG_PREFIX = 'android-v';
const DISMISSED = 'zenigma.apkPromo.dismissed';

/** The Android app download offered to people on the web. Never shown inside the Android app itself. */
@Injectable({ providedIn: 'root' })
export class ApkPromoService {
  private readonly http = inject(HttpClient);

  /** Only the web shows the promo. */
  readonly applicable = Capacitor.getPlatform() === 'web';
  readonly info = signal<ApkInfo | null>(null);
  readonly dismissed = signal(this.wasDismissed());
  readonly releasesPage = `https://github.com/${environment.githubRepo}/releases`;

  async load(): Promise<void> {
    if (!this.applicable || this.info()) return;
    try {
      const releases = await firstValueFrom(this.http.get<Release[]>(`https://api.github.com/repos/${environment.githubRepo}/releases?per_page=15`));
      const latest = releases
        .filter((r) => !r.draft && !r.prerelease && r.tag_name.startsWith(TAG_PREFIX))
        .map((r) => ({ r, version: r.tag_name.slice(TAG_PREFIX.length) }))
        .sort((a, b) => (isNewer(a.version, b.version) ? -1 : 1))[0];
      const apk = latest?.r.assets.find((a) => a.name.endsWith('.apk'));
      if (latest && apk) this.info.set({ version: latest.version, url: apk.browser_download_url, sizeMb: apk.size ? Math.round((apk.size / 1048576) * 10) / 10 : null });
    } catch {
      /* the card still links to the releases page */
    }
  }

  dismiss(): void {
    this.dismissed.set(true);
    try {
      localStorage.setItem(DISMISSED, String(Date.now()));
    } catch {
      /* private mode */
    }
  }

  /** Dismissed cards come back after two weeks. */
  private wasDismissed(): boolean {
    try {
      const at = Number(localStorage.getItem(DISMISSED));
      return at > 0 && Date.now() - at < 14 * 24 * 60 * 60 * 1000;
    } catch {
      return false;
    }
  }
}
