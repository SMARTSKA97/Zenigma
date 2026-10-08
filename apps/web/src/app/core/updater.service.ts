import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { App } from '@capacitor/app';
import { Capacitor, PluginListenerHandle, registerPlugin } from '@capacitor/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

interface ApkInstallerPlugin {
  canInstall(): Promise<{ allowed: boolean }>;
  openInstallSettings(): Promise<void>;
  downloadAndInstall(options: { url: string; sha256?: string }): Promise<void>;
  addListener(
    event: 'downloadProgress',
    handler: (p: { received: number; total: number }) => void,
  ): Promise<PluginListenerHandle>;
}

const ApkInstaller = registerPlugin<ApkInstallerPlugin>('ApkInstaller');

interface GithubAsset {
  name: string;
  browser_download_url: string;
  digest?: string | null;
}
interface GithubRelease {
  tag_name: string;
  body: string | null;
  prerelease: boolean;
  draft: boolean;
  assets: GithubAsset[];
}

export interface AvailableUpdate {
  version: string;
  notes: string;
  url: string;
  sha256?: string;
}

export type UpdateState = 'idle' | 'checking' | 'upToDate' | 'available' | 'downloading' | 'needsPermission' | 'error';

const TAG_PREFIX = 'android-v';

/** True when `a` is a newer dotted version than `b`. */
export function isNewer(a: string, b: string): boolean {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

/**
 * In-app updates from GitHub Releases. Runs only when the user taps "Check for updates" - no background
 * checks, so the app stays silent and makes no requests of its own.
 */
@Injectable({ providedIn: 'root' })
export class UpdaterService {
  private readonly http = inject(HttpClient);

  readonly supported = Capacitor.getPlatform() === 'android';
  readonly state = signal<UpdateState>('idle');
  readonly currentVersion = signal<string | null>(null);
  readonly update = signal<AvailableUpdate | null>(null);
  readonly progress = signal(0);
  readonly message = signal<string | null>(null);

  async loadVersion(): Promise<void> {
    if (!this.supported) return;
    try {
      this.currentVersion.set((await App.getInfo()).version);
    } catch {
      /* version stays unknown */
    }
  }

  async check(): Promise<void> {
    this.state.set('checking');
    this.message.set(null);
    try {
      await this.loadVersion();
      const releases = await firstValueFrom(
        this.http.get<GithubRelease[]>(`https://api.github.com/repos/${environment.githubRepo}/releases?per_page=15`),
      );
      const latest = releases
        .filter((r) => !r.draft && !r.prerelease && r.tag_name.startsWith(TAG_PREFIX))
        .map((r) => ({ release: r, version: r.tag_name.slice(TAG_PREFIX.length) }))
        .sort((x, y) => (isNewer(x.version, y.version) ? -1 : 1))[0];
      const apk = latest?.release.assets.find((a) => a.name.endsWith('.apk'));
      const current = this.currentVersion();
      if (!latest || !apk || !current || !isNewer(latest.version, current)) {
        this.state.set('upToDate');
        return;
      }
      this.update.set({
        version: latest.version,
        notes: latest.release.body ?? '',
        url: apk.browser_download_url,
        sha256: apk.digest?.replace('sha256:', ''),
      });
      this.state.set('available');
    } catch {
      this.message.set('Could not check for updates. Are you online?');
      this.state.set('error');
    }
  }

  async install(): Promise<void> {
    const update = this.update();
    if (!update) return;
    try {
      if (!(await ApkInstaller.canInstall()).allowed) {
        this.state.set('needsPermission');
        return;
      }
      this.progress.set(0);
      this.state.set('downloading');
      const handle = await ApkInstaller.addListener('downloadProgress', (p) =>
        this.progress.set(p.total > 0 ? Math.min(1, p.received / p.total) : 0),
      );
      try {
        await ApkInstaller.downloadAndInstall({ url: update.url, sha256: update.sha256 });
      } finally {
        await handle.remove();
      }
      this.state.set('available');
    } catch (error) {
      this.message.set(error instanceof Error ? error.message : 'The update failed.');
      this.state.set('error');
    }
  }

  async allowInstalls(): Promise<void> {
    await ApkInstaller.openInstallSettings();
    this.state.set('available');
  }
}
