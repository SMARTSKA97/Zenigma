import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatDuration } from '../../core/leaderboard.service';
import { gameInfo } from '../../games/catalog';
import { WordDailyService } from '../../games/mind/word-daily';
import { Glyph } from '../../shared/glyph';

/** The word dailies in the Puzzles tab: one puzzle each, the same for everyone today. Works offline and signed out. */
@Component({
  selector: 'app-word-daily-panel',
  imports: [RouterLink, Glyph],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './word-daily-panel.html',
  styleUrl: '../mind/mind-daily-panel.scss',
})
export class WordDailyPanel implements OnInit {
  protected readonly daily = inject(WordDailyService);

  ngOnInit(): void {
    this.daily.refresh();
  }

  protected info(id: string) {
    return gameInfo(id);
  }

  protected time(ms: number): string {
    return formatDuration(ms);
  }
}
