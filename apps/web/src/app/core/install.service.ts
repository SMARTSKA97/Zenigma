import { Injectable, signal } from '@angular/core';

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
