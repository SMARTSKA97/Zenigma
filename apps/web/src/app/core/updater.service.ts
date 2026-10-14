import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { App } from '@capacitor/app';
import { Capacitor, PluginListenerHandle, registerPlugin } from '@capacitor/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

interface ApkInstallerPlugin {
  installSource(): Promise<{ installer: string }>;
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

export type UpdateState =
  | 'idle'
  | 'checking'
  | 'upToDate'
  | 'available'
  | 'downloading'
  | 'installing'
  | 'needsPermission'
  | 'error';

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
 * In-app updates from GitHub Releases. The app looks for an update when it opens and when it comes back to the
 * foreground (at most every six hours); nothing is polled in the background. Installing is always the person's tap.
 */
@Injectable({ providedIn: 'root' })
export class UpdaterService {
  private readonly http = inject(HttpClient);

  readonly supported = Capacitor.getPlatform() === 'android';
  /** True when Google Play installed the app: Play updates it, so the in-app APK updater stays out of the way (Play's policy). */
  readonly fromPlay = signal(false);

  constructor() {
    if (this.supported) {
      void ApkInstaller.installSource()
        .then((r) => this.fromPlay.set(r.installer === 'com.android.vending'))
        .catch(() => undefined);
    }
  }
  readonly state = signal<UpdateState>('idle');
  readonly currentVersion = signal<string | null>(null);
  readonly update = signal<AvailableUpdate | null>(null);
  readonly progress = signal(0);
  /** Bytes downloaded and expected, for "12.4 of 29.8 MB". */
  readonly received = signal(0);
  readonly total = signal(0);
  /** Whether the update sheet is showing. Opened by a check that finds an update; closed by "Later". */
  readonly sheetOpen = signal(false);
  readonly message = signal<string | null>(null);

  async loadVersion(): Promise<void> {
    if (!this.supported) return;
    try {
      this.currentVersion.set((await App.getInfo()).version);
    } catch {
      /* version stays unknown */
    }
  }

  /** Checks on open and on return to the app. Quiet: no spinner state, and failures say nothing. */
  startAutoCheck(): void {
    if (!this.supported || this.fromPlay() || this.autoStarted) return;
    this.autoStarted = true;
    // A moment after launch, so it never competes with the first screen (or the "What's new" sheet).
    setTimeout(() => void this.autoCheck(), 2500);
    void App.addListener('appStateChange', (s) => {
      if (s.isActive) void this.autoCheck();
    });
  }

  private autoStarted = false;
  private lastAuto = 0;

  private async autoCheck(): Promise<void> {
    if (this.fromPlay()) return;
    const busy: UpdateState[] = ['checking', 'downloading', 'installing', 'needsPermission'];
    if (busy.includes(this.state()) || this.sheetOpen()) return;
    const sixHours = 6 * 60 * 60 * 1000;
    if (Date.now() - this.lastAuto < sixHours) return;
    this.lastAuto = Date.now();
    await this.check();
    // A failed or "up to date" automatic check should not show anything on the Settings screen.
    if (this.state() === 'error') this.state.set('idle');
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
      this.sheetOpen.set(true);
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
      this.received.set(0);
      this.total.set(0);
      this.state.set('downloading');
      const handle = await ApkInstaller.addListener('downloadProgress', (p) => {
        this.received.set(p.received);
        this.total.set(p.total);
        const done = p.total > 0 ? Math.min(1, p.received / p.total) : 0;
        this.progress.set(done);
        // Everything is on the device: from here Android verifies and opens its own installer.
        if (done >= 1) this.state.set('installing');
      });
      try {
        await ApkInstaller.downloadAndInstall({ url: update.url, sha256: update.sha256 });
      } finally {
        await handle.remove();
      }
      this.state.set('available');
      this.sheetOpen.set(false);
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
