import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AuthService, DeviceInfo } from '../core/auth.service';

/** The devices signed in to this account: sign one out, sign out all the others, or everywhere. */
@Component({
  selector: 'app-devices',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="head">
      <b>Signed-in devices</b>
      <small>{{ list().length }} of {{ limit() }}</small>
    </div>
    @if (failed()) {
      <p class="muted">Could not load the devices. Check your connection.</p>
    }
    <ul>
      @for (d of list(); track d.id) {
        <li>
          <span class="t">
            <b>{{ d.name }}@if (d.current) { <em>This device</em> }</b>
            <small>Last used {{ d.lastUsedAt | date: 'd MMM, HH:mm' }}</small>
          </span>
          <button type="button" class="out" [disabled]="busy()" (click)="out(d)">Sign out</button>
        </li>
      }
    </ul>
    @if (list().length > 1) {
      <button type="button" class="link" [disabled]="busy()" (click)="others()">Sign out all other devices</button>
    }
    @if (list().length) {
      <button type="button" class="link" [disabled]="busy()" (click)="everywhere()">Sign out of every device</button>
    }
    <p class="muted fine">A free account can be signed in on {{ free }} device; supporters can use {{ paid }}. A signed-out device loses access within about 15 minutes.</p>
  `,
  styles: `
    :host { display: grid; gap: 0.6rem; }
    .head { display: flex; align-items: center; justify-content: space-between; }
    small, .muted { color: var(--muted); }
    .fine { font-size: 0.8rem; margin: 0; }
    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; }
    li { display: flex; align-items: center; gap: 0.7rem; padding: 0.6rem 0.8rem; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); }
    .t { flex: 1; display: grid; min-width: 0; }
    em { margin-left: 0.4rem; padding: 0.05rem 0.45rem; border-radius: 999px; background: var(--accent-soft); color: var(--accent); font-size: 0.72rem; font-style: normal; font-weight: 700; }
    .out { padding: 0.35rem 0.8rem; min-height: 0; }
    .link { justify-self: start; background: none; border: 0; padding: 0.2rem 0; color: var(--accent); font: inherit; font-weight: 600; cursor: pointer; min-height: 0; }
  `,
})
export class Devices implements OnInit {
  private readonly auth = inject(AuthService);
  protected readonly list = signal<DeviceInfo[]>([]);
  protected readonly limit = signal(1);
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  protected readonly free = 1;
  protected readonly paid = 5;

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const r = await this.auth.devices();
      this.list.set(r.devices);
      this.limit.set(r.limit);
      this.failed.set(false);
    } catch {
      this.failed.set(true);
    }
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    try {
      await action();
      await this.load();
    } catch {
      this.failed.set(true);
    } finally {
      this.busy.set(false);
    }
  }

  protected out(d: DeviceInfo): Promise<void> {
    return this.run(() => this.auth.signOutDevice(d.id));
  }

  protected others(): Promise<void> {
    return this.run(() => this.auth.signOutDevices(true));
  }

  protected everywhere(): Promise<void> {
    return this.run(() => this.auth.signOutDevices(false));
  }
}
