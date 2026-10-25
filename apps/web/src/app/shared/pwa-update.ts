import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PwaUpdateService } from '../core/pwa-update.service';

/** "A new version is ready": one tap to reload into it. Shown on the installed web app (including iPhone and iPad). */
@Component({
  selector: 'app-pwa-update',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (u.ready()) {
      <div class="bar" role="status">
        <span><strong>Update ready</strong> A new version of Zenigma is here.</span>
        <button type="button" (click)="u.apply()">Reload</button>
      </div>
    }
  `,
  styles: `
    .bar {
      position: fixed;
      left: 50%;
      bottom: calc(5.2rem + env(safe-area-inset-bottom));
      transform: translateX(-50%);
      z-index: 60;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      width: min(92vw, 26rem);
      padding: 0.6rem 0.75rem 0.6rem 1rem;
      border-radius: 999px;
      background: var(--text);
      color: var(--bg);
      box-shadow: 0 8px 28px rgb(0 0 0 / 0.3);
      font-size: 0.85rem;
    }
    span {
      flex: 1;
      min-width: 0;
    }
    strong {
      display: block;
    }
    button {
      min-height: 0;
      padding: 0.45rem 1rem;
      border: 0;
      border-radius: 999px;
      background: var(--accent);
      color: #fff;
      font: inherit;
      font-weight: 700;
      box-shadow: none;
    }
  `,
})
export class PwaUpdate {
  protected readonly u = inject(PwaUpdateService);
}
