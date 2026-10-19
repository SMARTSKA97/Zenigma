import { inject, Injectable, NgZone, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { variantsOf } from '../games/catalog';

const EXIT_WINDOW_MS = 2000;

/** The pages a game is started from. Leaving a game (or finishing it) goes back to the one it was opened from. */
const HUBS = ['', 'challenges', 'practice', 'mind', 'ranks', 'stats'];

/**
 * What the Back button does. It never walks through the pile of pages visited: it closes a sheet if one is open,
 * otherwise goes up one level (out of a game, then home), and on Home asks for a second press to exit the app.
 */
@Injectable({ providedIn: 'root' })
export class BackService {
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);

  /** A short message shown over the page ("Press back again to exit"). */
  readonly toast = signal<string | null>(null);
  private lastBack = 0;
  private toastTimer?: ReturnType<typeof setTimeout>;
  private readonly overlays: (() => void)[] = [];
  /** The last hub page visited (Home, Challenges, Practice, Mind…): where a game goes back to. */
  private origin: string | null = null;

  constructor() {
    this.router.events.subscribe((e) => {
      if (!(e instanceof NavigationEnd)) return;
      const first = e.urlAfterRedirects.split(/[?#]/)[0].split('/').filter(Boolean)[0] ?? '';
      if (HUBS.includes(first)) this.origin = e.urlAfterRedirects;
    });
  }

  /** Starts listening for the Android Back button (does nothing in a browser, which has its own). */
  listen(): void {
    if (!Capacitor.isNativePlatform()) return;
    void App.addListener('backButton', () => this.zone.run(() => this.press()));
  }

  /** A sheet or dialog registers how to close itself; Back closes the newest one first. Returns the unregister function. */
  registerOverlay(close: () => void): () => void {
    this.overlays.push(close);
    return () => {
      const at = this.overlays.lastIndexOf(close);
      if (at >= 0) this.overlays.splice(at, 1);
    };
  }

  /** The page one level up from a URL, or null on Home. */
  parentOf(url: string, origin: string | null = null): string | null {
    const path = url.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
    const parts = path.split('/').filter(Boolean);
    if (parts.length === 0) return null;
    const [a, b, c, d] = parts;
    // A game or a daily goes back to the page it was opened from; with no memory of one, to Practice or Challenges.
    const from = (fallback: string): string => origin ?? fallback;
    if (a === 'games') {
      if (parts.length === 1) return '/practice';
      if (b === 'word-guess') return from('/practice');
      if (d === 'levels' || c === 'levels') return from('/practice'); // a level map
      // A level on a variant (/games/sudoku/mini) or a plain game (/games/queens): up to its map.
      if (parts.length === 3 && variantsOf(b).some((v) => v.id === c && v.tiered)) return from('/practice'); // a difficulty chooser
      return parts.length === 3 ? `/games/${b}/${c}/levels` : parts.length === 2 ? this.mapOrPicker(b, origin) : from('/practice');
    }
    if (a === 'speed') return from('/practice');
    if (a === 'mind') return parts.length === 1 ? '/' : from('/mind');
    if (a === 'daily') return parts.length === 1 ? '/' : from('/challenges');
    if (a === 'daily-word') return from('/challenges');
    if (a === 'rules') return parts.length === 1 ? '/settings' : '/rules';
    if (a === 'ranks' && parts.length > 1) return '/ranks';
    if (['practice', 'daily', 'challenges', 'ranks', 'settings', 'stats', 'store', 'sync-test'].includes(a)) return '/';
    if (a === 'badges') return '/stats';
    // About, privacy, version history, account…
    return '/settings';
  }

  private mapOrPicker(game: string, origin: string | null): string {
    // A game with variants (Sudoku) has a chooser, and its levels hang off a variant; everything else goes up to its level map.
    return variantsOf(game).length ? (origin ?? '/practice') : `/games/${game}/levels`;
  }

  /** Same as the Android Back button; used by the arrow in a page's header. */
  up(event?: Event): void {
    event?.preventDefault();
    this.press(false);
  }

  /** `allowExit` is true for the hardware button, which on Home exits the app on a second press. */
  private press(allowExit = true): void {
    const overlay = this.overlays[this.overlays.length - 1];
    if (overlay) {
      overlay();
      return;
    }
    const parent = this.parentOf(this.router.url, this.origin);
    if (parent) {
      void this.router.navigateByUrl(parent, { replaceUrl: true });
      return;
    }
    if (!allowExit) return;
    const now = Date.now();
    if (now - this.lastBack < EXIT_WINDOW_MS) {
      void App.exitApp();
      return;
    }
    this.lastBack = now;
    this.say('Press back again to exit');
  }

  private say(text: string): void {
    this.toast.set(text);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), EXIT_WINDOW_MS);
  }
}
