import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ConnectionService } from '../../core/connection.service';
import { SyncService } from '../../core/sync.service';
import { ReminderService } from '../../core/reminder.service';
import { Loader } from '../../shared/loader';
import { Segmented, SegmentOption } from '../../shared/segmented';
import { Switch } from '../../shared/switch';
import { InstallService } from '../../core/install.service';
import { HapticStrength, PrefsService } from '../../core/prefs.service';
import { ThemeMode, ThemeService } from '../../core/theme.service';
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
  protected readonly conn = inject(ConnectionService);
  protected readonly reminder = inject(ReminderService);
  protected readonly install = inject(InstallService);
  protected readonly accents = [
    { id: 'default', name: 'Ocean', color: '#2b3dae' },
    { id: 'sunset', name: 'Sunset', color: '#c2410c' },
    { id: 'forest', name: 'Forest', color: '#15803d' },
    { id: 'orchid', name: 'Orchid', color: '#a21caf' },
    { id: 'gold', name: 'Gold', color: '#a16207' },
  ];
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

  /** Everything Zenigma keeps on this device, as one JSON file. Sign-in tokens are left out. */
  protected exportData(): void {
    const data: Record<string, unknown> = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith('zenigma.') || /token|auth|jwt|secret|password/i.test(key)) continue;
        const raw = localStorage.getItem(key) ?? '';
        try {
          data[key] = JSON.parse(raw);
        } catch {
          data[key] = raw;
        }
      }
    } catch {
      /* no storage: an empty export */
    }
    const blob = new Blob([JSON.stringify({ app: 'Zenigma', exportedAt: new Date().toISOString(), data }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zenigma-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  ngOnInit(): void {
    void this.updater.loadVersion();
  }
}
