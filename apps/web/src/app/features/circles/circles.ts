import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { CircleSeasons } from '../../shared/circle-seasons';
import { Circle, CirclesService, inviteLink } from '../../core/circles.service';

@Component({
  selector: 'app-circles',
  imports: [RouterLink, CircleSeasons],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="back" routerLink="/ranks">← Leaderboards</a>
    <h1>Circles</h1>
    <p class="muted">Private groups of friends. Share a code and compete on your own leaderboard.</p>

    @if (!auth.signedIn()) {
      <section class="card">
        <p class="muted">Sign in to create or join a circle.</p>
        <a class="button" routerLink="/account">Sign in</a>
      </section>
    } @else {
      <div class="forms">
        <form class="card" (submit)="create($event, newName)">
          <h2>Start a circle</h2>
          <input #newName type="text" maxlength="40" placeholder="Name, e.g. Office crew" aria-label="Circle name" autocomplete="off" />
          <button type="submit" [disabled]="busy()">Create</button>
        </form>
        <form class="card" (submit)="join($event, code)">
          <h2>Join with a code</h2>
          <input #code type="text" maxlength="6" placeholder="6-character code" aria-label="Circle code" autocapitalize="characters" autocomplete="off" [value]="prefill()" />
          <button type="submit" [disabled]="busy()">Join</button>
        </form>
      </div>
      @if (message(); as m) {
        <p class="note" role="status">{{ m }}</p>
      }

      <app-circle-seasons />

      @if (loading()) {
        <div class="skeleton line"></div>
      } @else if (circles().length === 0) {
        <section class="card empty"><p class="muted">You are not in a circle yet.</p></section>
      } @else {
        <ul class="list">
          @for (c of circles(); track c.id) {
            <li class="card item">
              <div class="head">
                <div>
                  <strong>{{ c.name }}</strong>
                  <span class="muted">{{ c.members }} {{ c.members === 1 ? 'member' : 'members' }}{{ c.isOwner ? ' · yours' : '' }}</span>
                </div>
                <code class="code" aria-label="Circle code">{{ c.code }}</code>
              </div>
              <div class="actions">
                <a class="button" [routerLink]="['/ranks']" [queryParams]="{ circle: c.id }">Leaderboard</a>
                <button type="button" (click)="share(c)">Invite</button>
                <button type="button" class="quiet" (click)="leave(c)">Leave</button>
              </div>
            </li>
          }
        </ul>
      }
    }
  `,
  styles: `
    :host { display: block; max-width: 40rem; margin: 0 auto; }
    .back { display: inline-block; margin-bottom: 0.5rem; font-size: 0.9rem; }
    .forms { display: grid; gap: 0.75rem; margin: 1rem 0; }
    form { display: grid; gap: 0.6rem; }
    h2 { font-size: 1rem; margin: 0; }
    .note { margin: 0 0 1rem; padding: 0.6rem 0.9rem; border-radius: 12px; background: var(--accent-soft); }
    .list { display: grid; gap: 0.6rem; margin: 0; padding: 0; list-style: none; }
    .item { display: grid; gap: 0.75rem; }
    .head { display: flex; justify-content: space-between; gap: 1rem; align-items: center; }
    .head div { display: grid; }
    .code { font-family: var(--font-display); font-size: 1.1rem; letter-spacing: 0.15em; padding: 0.3rem 0.7rem; border-radius: 10px; background: var(--surface-2); }
    .actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .empty { text-align: center; }
  `,
})
export class Circles {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(CirclesService);
  private readonly route = inject(ActivatedRoute);

  protected readonly circles = signal<Circle[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly message = signal('');
  protected readonly prefill = signal((this.route.snapshot.queryParamMap.get('join') ?? '').toUpperCase().slice(0, 6));

  constructor() {
    if (this.auth.signedIn()) void this.reload();
    else this.loading.set(false);
  }

  private async reload(): Promise<void> {
    try {
      this.circles.set(await this.api.list());
    } catch {
      this.message.set('Could not load your circles.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async create(event: Event, input: HTMLInputElement): Promise<void> {
    event.preventDefault();
    await this.run(async () => {
      const c = await this.api.create(input.value);
      input.value = '';
      this.message.set(`"${c.name}" created. Share code ${c.code} with your friends.`);
    });
  }

  protected async join(event: Event, input: HTMLInputElement): Promise<void> {
    event.preventDefault();
    await this.run(async () => {
      const c = await this.api.join(input.value);
      input.value = '';
      this.prefill.set('');
      this.message.set(`Joined "${c.name}".`);
    });
  }

  protected async leave(c: Circle): Promise<void> {
    await this.run(async () => {
      await this.api.leave(c.id);
      this.message.set(`Left "${c.name}".`);
    });
  }

  protected async share(c: Circle): Promise<void> {
    const text = `Join my Zenigma circle "${c.name}" with code ${c.code}: ${inviteLink(c.code)}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        this.message.set('Invite copied.');
      }
    } catch {
      /* cancelled */
    }
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.message.set('');
    try {
      await action();
      await this.reload();
    } catch (e) {
      const err = e instanceof HttpErrorResponse ? (e.error as { error?: string } | null)?.error : undefined;
      this.message.set(err ?? 'Something went wrong. Try again.');
    } finally {
      this.busy.set(false);
    }
  }
}
