import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HintsService } from '../../core/hints.service';
import { ChallengeState, PERIOD_NAMES, Period, timeLeft } from './challenge-engine';
import { ChallengesService } from './challenges.service';
import { featuredFor } from './featured';
import { PracticeStore } from '../../games/puzzle/practice.store';
import { gameInfo } from '../../games/catalog';
import { Glyph } from '../../shared/glyph';

const ORDER: Period[] = ['weekly', 'weekend', 'monthly'];

/** A short summary of the three challenge periods. Tap it to open all the goals. Used on Home, Daily and Practice. */
@Component({
  selector: 'app-challenge-strip',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './challenge-strip.html',
  styleUrl: './challenge-strip.scss',
})
export class ChallengeStrip implements OnInit {
  protected readonly c = inject(ChallengesService);
  protected readonly order = ORDER;
  protected readonly names = PERIOD_NAMES;

  ngOnInit(): void {
    void this.c.load();
  }

  protected progress(s: ChallengeState): number {
    return Math.min(100, Math.round((s.have / s.template.target) * 100));
  }

  protected done(items: ChallengeState[]): number {
    return items.filter((i) => i.done).length;
  }
}

/** The featured level of the week: one hard level, the same for everyone, open all week. */
@Component({
  selector: 'app-featured-level',
  imports: [RouterLink, Glyph],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './featured-level.html',
  styleUrl: './featured-level.scss',
})
export class FeaturedLevel implements OnInit {
  private readonly practice = inject(PracticeStore);
  protected readonly f = featuredFor(new Date());
  protected readonly hue = () => gameInfo(this.f.game)?.hue ?? 200;
  private readonly loaded = signal(0);
  protected readonly done = computed(() => {
    this.loaded();
    return this.practice.isSolved(this.f.track, this.f.level);
  });
  protected readonly link = () => ['/games', this.f.game, ...(this.f.variant ? [this.f.variant] : [])];

  ngOnInit(): void {
    void this.practice.load(this.f.track).then(() => this.loaded.update((n) => n + 1));
  }
}

/** All weekly, weekend and monthly goals, with progress and the hints they earn. */
@Component({
  selector: 'app-challenges',
  imports: [RouterLink, FeaturedLevel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './challenges-page.html',
  styleUrl: './challenges-page.scss',
})
export class ChallengesPage implements OnInit {
  protected readonly c = inject(ChallengesService);
  protected readonly hints = inject(HintsService);
  protected readonly order = ORDER;
  protected readonly names = PERIOD_NAMES;
  protected readonly message = signal('');
  protected readonly signedIn = computed(() => this.c.stats() !== null);

  ngOnInit(): void {
    void this.c.load();
  }

  protected min(s: ChallengeState): number {
    return Math.min(s.have, s.template.target);
  }

  protected left(items: ChallengeState[]): string {
    const w = items[0]?.window;
    if (!w) return '';
    const t = timeLeft(w, this.c.now());
    return w.open ? `${t} left` : `Starts Saturday, in ${t}`;
  }

  protected collect(s: ChallengeState): void {
    const added = this.c.claim(s);
    this.message.set(added > 0 ? `+${added} ${added === 1 ? 'hint' : 'hints'} collected${this.c.owed(s) > 0 ? '. Spend a few and collect the rest.' : ''}` : 'Your hint stash is full. Spend a few, then collect.');
    setTimeout(() => this.message.set(''), 3000);
  }
}

