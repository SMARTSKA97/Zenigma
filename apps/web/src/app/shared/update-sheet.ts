import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { UpdaterService } from '../core/updater.service';
import { Loader } from './loader';
import { Notes } from './notes';
import { Sheet } from './sheet';

/** The update flow: what's new, then a download with live progress, then hand-off to Android's installer. */
@Component({
  selector: 'app-update-sheet',
  imports: [DecimalPipe, Loader, Notes, Sheet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './update-sheet.html',
  styleUrl: './update-sheet.scss',
})
export class UpdateSheet {
  protected readonly updater = inject(UpdaterService);

  protected readonly busy = computed(() => ['downloading', 'installing'].includes(this.updater.state()));
  protected readonly visible = computed(
    () => this.updater.sheetOpen() && ['available', 'downloading', 'installing', 'needsPermission', 'error'].includes(this.updater.state()),
  );

  protected close(): void {
    this.updater.sheetOpen.set(false);
  }

  protected mb(bytes: number): string {
    return (bytes / 1_048_576).toFixed(1);
  }
}
