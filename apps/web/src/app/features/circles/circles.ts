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
  templateUrl: './circles.html',
  styleUrl: './circles.scss',
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
