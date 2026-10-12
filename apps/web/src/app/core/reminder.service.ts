import { Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const KEY = 'zenigma.reminder';
/** One notification per weekday, ids 41 to 47, so the text can follow the week's difficulty. */
const IDS = [41, 42, 43, 44, 45, 46, 47];

const MESSAGES = [
  'Sunday is the hardest daily of the week. Ready for it?',
  'A gentle Monday set is waiting. Start your week with a win.',
  "Tuesday's daily puzzles are ready.",
  "Midweek: today's puzzles are a notch harder.",
  "Thursday's set is up. Keep your streak going.",
  "Friday's dailies are ready. Finish before the weekend.",
  "Saturday's set is a tough one. Give it a go.",
];

interface Saved {
  enabled: boolean;
  hour: number;
  minute: number;
}

/**
 * An optional daily reminder on Android, scheduled on the device (no server, no account, works offline).
 * Off until the person turns it on and allows notifications.
 */
@Injectable({ providedIn: 'root' })
export class ReminderService {
  readonly supported = Capacitor.getPlatform() === 'android';
  readonly enabled = signal(false);
  readonly hour = signal(19);
  readonly minute = signal(0);
  /** Set when the system refused notifications, so Settings can say where to allow them. */
  readonly denied = signal(false);

  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Saved>;
      this.enabled.set(saved.enabled === true);
      this.hour.set(saved.hour ?? 19);
      this.minute.set(saved.minute ?? 0);
    } catch {
      /* defaults */
    }
  }

  /** "19:00", for the time input. */
  readonly timeValue = () => `${String(this.hour()).padStart(2, '0')}:${String(this.minute()).padStart(2, '0')}`;

  /** Re-applies the saved schedule (Android can drop alarms after an update or reboot). Quiet if reminders are off. */
  async restore(): Promise<void> {
    if (!this.supported || !this.enabled()) return;
    try {
      if ((await LocalNotifications.checkPermissions()).display !== 'granted') return;
      await this.schedule();
    } catch {
      /* nothing to do */
    }
  }

  async setEnabled(on: boolean): Promise<void> {
    if (!this.supported) return;
    this.denied.set(false);
    try {
      if (on) {
        let status = (await LocalNotifications.checkPermissions()).display;
        if (status !== 'granted') status = (await LocalNotifications.requestPermissions()).display;
        if (status !== 'granted') {
          this.denied.set(true);
          this.enabled.set(false);
          this.save();
          return;
        }
        this.enabled.set(true);
        await this.schedule();
      } else {
        this.enabled.set(false);
        await LocalNotifications.cancel({ notifications: IDS.map((id) => ({ id })) });
      }
    } catch {
      this.enabled.set(false);
    }
    this.save();
  }

  async setTime(value: string): Promise<void> {
    const [h, m] = value.split(':').map((n) => parseInt(n, 10));
    if (!Number.isFinite(h) || !Number.isFinite(m)) return;
    this.hour.set(h);
    this.minute.set(m);
    this.save();
    if (this.enabled()) await this.schedule().catch(() => undefined);
  }

  private async schedule(): Promise<void> {
    await LocalNotifications.cancel({ notifications: IDS.map((id) => ({ id })) });
    await LocalNotifications.schedule({
      notifications: IDS.map((id, i) => ({
        id,
        title: 'Zenigma',
        body: MESSAGES[i],
        // Capacitor weekdays run 1 (Sunday) to 7 (Saturday); ids 41..47 follow the same order.
        schedule: { on: { weekday: i + 1, hour: this.hour(), minute: this.minute() }, allowWhileIdle: true },
      })),
    });
  }

  private save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify({ enabled: this.enabled(), hour: this.hour(), minute: this.minute() } satisfies Saved));
    } catch {
      /* lasts for this session */
    }
  }
}
