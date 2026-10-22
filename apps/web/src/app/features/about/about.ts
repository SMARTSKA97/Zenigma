import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { environment } from '../../../environments/environment';
import { UpdaterService } from '../../core/updater.service';

@Component({
  selector: 'app-about',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './about.html',
  styleUrl: './about.scss',
})
export class About implements OnInit {
  private readonly updater = inject(UpdaterService);
  protected readonly version = this.updater.currentVersion;
  protected readonly platform = Capacitor.getPlatform() === 'android' ? 'Android app' : 'Web app';
  protected readonly source = `https://github.com/${environment.githubRepo}`;
  protected readonly support = environment.support;
  protected readonly copied = signal('');
  /** Tips are for the website and sideloaded builds: Google Play wants its own billing for anything paid inside an app from the Play Store. */
  protected readonly canDonate = computed(
    () => !this.updater.fromPlay() && !!(this.support.kofiUrl || this.support.upiId || this.support.paypalUrl),
  );
  protected readonly upiLink = `upi://pay?pa=${encodeURIComponent(environment.support.upiId)}&pn=${encodeURIComponent('Zenigma')}&cu=INR`;

  protected async copy(key: string, text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.copied.set(key);
      setTimeout(() => this.copied.set(''), 1800);
    } catch {
      /* clipboard blocked: the value is on screen to copy by hand */
    }
  }

  ngOnInit(): void {
    void this.updater.loadVersion();
  }
}
