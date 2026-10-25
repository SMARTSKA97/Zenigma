import { computed, Injectable, signal } from '@angular/core';

/** iPhone or iPad (iPadOS says it is a Mac, so touch points give it away). */
export function isIosDevice(): boolean {
  return typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
}

/**
 * Android, including a browser set to "Desktop site" (whose user agent no longer says Android: it still reports touch on Linux,
 * and Chromium's userAgentData says Android when the user agent does not).
 */
export function isAndroidDevice(): boolean {
  if (typeof navigator === 'undefined' || isIosDevice()) return false;
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return true;
  const hinted = (navigator as unknown as { userAgentData?: { platform?: string } }).userAgentData?.platform;
  if (hinted === 'Android') return true;
  return /Linux/.test(ua) && !/CrOS/.test(ua) && navigator.maxTouchPoints > 1;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (navigator as unknown as { standalone?: boolean }).standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** The browser's "install this app" prompt, kept until the person asks for it (Settings): the PWA works offline once installed. */
@Injectable({ providedIn: 'root' })
export class InstallService {
  private event: InstallPromptEvent | null = null;
  /** True while the browser is offering to install the app. */
  readonly available = signal(false);
  readonly installed = signal(false);
  /** The picture guide for iPhone and iPad: which tab is open, or null when closed. */
  readonly guide = signal<'install' | 'update' | null>(null);
  /** iOS has no install prompt: people add the page to the Home Screen by hand, so we show the steps. */
  readonly isIos = isIosDevice();
  readonly iosGuide = computed(() => this.isIos && !isStandalone() && !this.installed());
  readonly canInstall = computed(() => this.available() || this.iosGuide());
  private readonly DISMISS = 'zenigma.iosInstall.dismissed';
  readonly iosHidden = signal(this.wasHidden());

  hideIosPromo(): void {
    this.iosHidden.set(true);
    try {
      localStorage.setItem(this.DISMISS, String(Date.now()));
    } catch {
      /* private mode */
    }
  }

  private wasHidden(): boolean {
    try {
      const at = Number(localStorage.getItem(this.DISMISS));
      return at > 0 && Date.now() - at < 14 * 24 * 60 * 60 * 1000;
    } catch {
      return false;
    }
  }

  constructor() {
    if (typeof window === 'undefined') return;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.event = e as InstallPromptEvent;
      this.available.set(true);
    });
    window.addEventListener('appinstalled', () => {
      this.event = null;
      this.available.set(false);
      this.installed.set(true);
    });
  }

  async install(): Promise<void> {
    const event = this.event;
    if (!event) return;
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === 'accepted') this.installed.set(true);
    this.event = null;
    this.available.set(false);
  }
}
