import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { AuthService } from '../core/auth.service';
import { StatsService } from '../core/stats.service';
import { CardInput, renderCard } from './share-card';
import { Sheet } from './sheet';

interface ShareCardPlugin {
  share(options: { data: string; text: string; title: string }): Promise<void>;
}
const ShareCard = registerPlugin<ShareCardPlugin>('ShareCard');

/** Shows the result card as a picture, and shares it (or saves it), with the emoji text as a fallback. */
@Component({
  selector: 'app-share-sheet',
  imports: [Sheet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-sheet label="Share your result" (closed)="closed.emit()">
      <div class="wrap">
        <h2>Share your result</h2>
        <div class="preview" [class.loading]="!url()">
          @if (url(); as src) {
            <img [src]="src" alt="Result card showing your finished board, time and streak" />
          }
        </div>
        <div class="actions">
          <button type="button" [disabled]="!blob()" (click)="send()">Share</button>
          <button type="button" class="secondary" [disabled]="!blob()" (click)="save()">Save image</button>
          <button type="button" class="secondary" (click)="copy()">{{ copied() ? 'Copied' : 'Copy text' }}</button>
        </div>
        @if (note()) {
          <p class="muted" role="status">{{ note() }}</p>
        }
      </div>
    </app-sheet>
  `,
  styles: `
    .wrap {
      display: grid;
      gap: 0.9rem;
      justify-items: center;
    }
    h2 {
      margin: 0;
    }
    .preview {
      width: min(18rem, 62vw);
      aspect-ratio: 1080 / 1350;
      border-radius: 18px;
      overflow: hidden;
      background: var(--surface-2);
      box-shadow: 0 8px 24px rgb(0 0 0 / 0.22);
    }
    .preview.loading {
      animation: pulse 1.2s ease-in-out infinite;
    }
    img {
      display: block;
      width: 100%;
      height: 100%;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 0.5rem;
    }
    .muted {
      margin: 0;
      font-size: 0.85rem;
    }
    @keyframes pulse {
      50% {
        opacity: 0.55;
      }
    }
  `,
})
export class ShareSheet {
  private readonly auth = inject(AuthService);
  private readonly stats = inject(StatsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly card = input.required<CardInput>();
  /** The emoji text, used as the caption and as the copy fallback. */
  readonly text = input.required<string>();
  /** The game's id in /stats, to add the streak (daily results only). */
  readonly game = input<string | null>(null);
  readonly closed = output<void>();

  protected readonly url = signal<string | null>(null);
  protected readonly blob = signal<Blob | null>(null);
  protected readonly copied = signal(false);
  protected readonly note = signal('');
  private made = false;

  constructor() {
    this.destroyRef.onDestroy(() => this.url() && URL.revokeObjectURL(this.url()!));
    effect(() => {
      const card = this.card();
      if (this.made) return;
      this.made = true;
      void this.make(card);
    });
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
      this.blob.set(blob);
      this.url.set(URL.createObjectURL(blob));
    } catch {
      this.note.set('Could not draw the picture. You can still copy the text.');
    }
  }

  protected async send(): Promise<void> {
    const blob = this.blob();
    if (!blob) return;
    const text = this.text();
    try {
      if (Capacitor.isNativePlatform()) {
        await ShareCard.share({ data: await toBase64(blob), text, title: 'Share result' });
        return;
      }
      const file = new File([blob], 'zenigma-result.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text });
      else if (navigator.share) await navigator.share({ text });
      else this.save();
    } catch (error) {
      if ((error as { name?: string }).name !== 'AbortError') this.note.set('Sharing is not available here. Try Save image.');
    }
  }

  protected save(): void {
    const src = this.url();
    if (!src) return;
    const a = document.createElement('a');
    a.href = src;
    a.download = 'zenigma-result.png';
    a.click();
    this.note.set('Saved to your downloads.');
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
