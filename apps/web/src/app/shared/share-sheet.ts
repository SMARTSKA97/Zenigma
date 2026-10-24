import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { AuthService } from '../core/auth.service';
import { StatsService } from '../core/stats.service';
import { CardInput, renderCard, renderStreak, StreakCardInput } from './share-card';
import { Sheet } from './sheet';

interface ShareCardPlugin {
  share(options: { data: string; text: string; title: string }): Promise<void>;
}
const ShareCard = registerPlugin<ShareCardPlugin>('ShareCard');

interface Slide {
  label: string;
  alt: string;
  url: string;
  blob: Blob;
  sticker: boolean;
}

/**
 * Shows the picture to share and sends it (or saves or copies it), with the emoji text as a fallback. A result is one card;
 * a streak is two to swipe between: a solid card and a clear sticker to lay over a photo.
 */
@Component({
  selector: 'app-share-sheet',
  imports: [Sheet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './share-sheet.html',
  styleUrl: './share-sheet.scss',
})
export class ShareSheet {
  private readonly auth = inject(AuthService);
  private readonly stats = inject(StatsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly card = input<CardInput | null>(null);
  /** Set to share a streak instead of a result. */
  readonly streakCard = input<StreakCardInput | null>(null);
  /** The emoji text, used as the caption and as the copy fallback. */
  readonly text = input.required<string>();
  /** The game's id in /stats, to add the streak (daily results only). */
  readonly game = input<string | null>(null);
  readonly closed = output<void>();

  protected readonly slides = signal<Slide[]>([]);
  protected readonly index = signal(0);
  protected readonly current = computed(() => this.slides()[this.index()] ?? null);
  protected readonly copied = signal(false);
  protected readonly imageCopied = signal(false);
  protected readonly note = signal('');
  protected readonly canCopyImage = typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write;
  private made = false;

  constructor() {
    this.destroyRef.onDestroy(() => this.slides().forEach((s) => URL.revokeObjectURL(s.url)));
    effect(() => {
      const card = this.card();
      const streak = this.streakCard();
      if (this.made) return;
      this.made = true;
      void (streak ? this.makeStreak(streak) : card ? this.make(card) : undefined);
    });
  }

  private add(slides: Omit<Slide, 'url'>[]): void {
    this.slides.set(slides.map((s) => ({ ...s, url: URL.createObjectURL(s.blob) })));
  }

  private async makeStreak(streak: StreakCardInput): Promise<void> {
    try {
      const [card, sticker] = await Promise.all([renderStreak(streak, 'card'), renderStreak(streak, 'sticker')]);
      this.add([
        { label: 'Card', alt: `${streak.days} day streak card`, blob: card, sticker: false },
        { label: 'Sticker', alt: `${streak.days} day streak sticker with a clear background`, blob: sticker, sticker: true },
      ]);
    } catch {
      this.note.set('Could not draw the picture. You can still copy the text.');
    }
  }

  private async make(card: CardInput): Promise<void> {
    let streak = card.streak ?? null;
    const game = this.game();
    if (game && this.auth.signedIn()) {
      try {
        const stats = await Promise.race([this.stats.load(), new Promise<null>((r) => setTimeout(() => r(null), 1500))]);
        streak = stats?.games.find((g) => g.game === game)?.current ?? streak;
      } catch {
        /* no streak line when offline */
      }
    }
    try {
      const blob = await renderCard({ ...card, streak });
      this.add([{ label: 'Result', alt: 'Result card showing your finished board, time and streak', blob, sticker: false }]);
    } catch {
      this.note.set('Could not draw the picture. You can still copy the text.');
    }
  }

  protected onScroll(event: Event): void {
    const rail = event.target as HTMLElement;
    this.index.set(Math.max(0, Math.min(this.slides().length - 1, Math.round(rail.scrollLeft / Math.max(1, rail.clientWidth)))));
  }

  protected async send(): Promise<void> {
    const slide = this.current();
    if (!slide) return;
    const text = this.text();
    try {
      if (Capacitor.isNativePlatform()) {
        await ShareCard.share({ data: await toBase64(slide.blob), text, title: 'Share' });
        return;
      }
      const file = new File([slide.blob], `zenigma-${slide.label.toLowerCase()}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text });
      else if (navigator.share) await navigator.share({ text });
      else this.save();
    } catch (error) {
      if ((error as { name?: string }).name !== 'AbortError') this.note.set('Sharing is not available here. Try Save.');
    }
  }

  protected save(): void {
    const slide = this.current();
    if (!slide) return;
    const a = document.createElement('a');
    a.href = slide.url;
    a.download = `zenigma-${slide.label.toLowerCase()}.png`;
    a.click();
    this.note.set('Saved to your downloads.');
  }

  protected async copyImage(): Promise<void> {
    const slide = this.current();
    if (!slide) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': slide.blob })]);
      this.imageCopied.set(true);
      setTimeout(() => this.imageCopied.set(false), 1800);
    } catch {
      this.note.set('Could not copy the picture. Try Save.');
    }
  }

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.text());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1800);
    } catch {
      this.note.set('Could not copy. Select the text from the result screen instead.');
    }
  }
}

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
