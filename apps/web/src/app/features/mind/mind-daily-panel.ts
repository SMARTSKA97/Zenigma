import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { gameInfo, SKILLS } from '../../games/catalog';
import { MindDailyService } from '../../games/mind/mind-daily';
import { MIND_META } from '../../games/mind/mind-meta';
import { Glyph } from '../../shared/glyph';

/** Today's mind set: three short games from three different skills, the same for everyone. */
@Component({
  selector: 'app-mind-daily-panel',
  imports: [RouterLink, Glyph],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mind-daily-panel.html',
  styleUrl: './mind-daily-panel.scss',
})
export class MindDailyPanel implements OnInit {
  protected readonly daily = inject(MindDailyService);

  ngOnInit(): void {
    this.daily.refresh();
  }

  protected info(id: string) {
    return gameInfo(id);
  }

  protected skill(id: string) {
    return SKILLS.find((s) => s.id === MIND_META[id as keyof typeof MIND_META]?.skill);
  }

  protected firstOpen(): string | null {
    return this.daily.games().find((g) => !this.daily.results()[g]) ?? null;
  }
}
