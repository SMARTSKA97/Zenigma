import { Component, computed, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { SyncService } from '../../core/sync.service';
import { ReminderService } from '../../core/reminder.service';
import { Loader } from '../../shared/loader';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { Switch } from '../../shared/switch';
import { InstallService } from '../../core/install.service';
import { HapticStrength, PrefsService } from '../../core/prefs.service';
import { ThemeMode, ThemeService } from '../../core/theme.service';
import { PracticeStore } from '../../games/puzzle/practice.store';
import { PRACTICE_TRACKS } from '../../games/catalog';
import { UpdaterService } from '../../core/updater.service';

@Component({
  selector: 'app-settings',
  imports: [RouterLink, Loader, Segmented, Switch],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings implements OnInit {
  protected readonly theme = inject(ThemeService);
  protected readonly updater = inject(UpdaterService);
  protected readonly prefs = inject(PrefsService);
  protected readonly auth = inject(AuthService);
  protected readonly sync = inject(SyncService);
  protected readonly reminder = inject(ReminderService);
  protected readonly install = inject(InstallService);
  private readonly practice = inject(PracticeStore);
  protected readonly accents = [
    { id: 'default', name: 'Ocean', color: '#2b3dae', need: 0 },
    { id: 'sunset', name: 'Sunset', color: '#c2410c', need: 0 },
    { id: 'forest', name: 'Forest', color: '#15803d', need: 0 },
    { id: 'orchid', name: 'Orchid', color: '#a21caf', need: 0 },
    { id: 'gold', name: 'Gold', color: '#a16207', need: 0 },
  ];
  /** Practice levels cleared in all games on this device. */
  protected readonly solvedTotal = computed(() => PRACTICE_TRACKS.reduce((n, t) => n + this.practice.solvedLevels(t.track)().size, 0));
  protected readonly strengths: SegmentOption<HapticStrength>[] = [
    { value: 'off', label: 'Off' },
    { value: 'light', label: 'Light' },
    { value: 'strong', label: 'Strong' },
  ];
  protected readonly themes: SegmentOption<ThemeMode>[] = [
    { value: 'system', label: 'System' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ];

  ngOnInit(): void {
    for (const t of PRACTICE_TRACKS) void this.practice.load(t.track);
    void this.updater.loadVersion();
  }
}
