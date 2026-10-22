import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { environment } from '../../../environments/environment';
import { UpdaterService } from '../../core/updater.service';
import { SupportService } from '../../core/support.service';
import { SupportMethods } from '../../shared/support-methods';
import { SupporterWall } from '../../shared/supporter-wall';

@Component({
  selector: 'app-about',
  imports: [RouterLink, SupportMethods, SupporterWall],
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
  protected readonly canDonate = inject(SupportService).canDonate;

  ngOnInit(): void {
    void this.updater.loadVersion();
  }
}
