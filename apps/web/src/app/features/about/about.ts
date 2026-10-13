import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
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

  ngOnInit(): void {
    void this.updater.loadVersion();
  }
}
