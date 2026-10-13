import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { formatDuration } from '../../core/leaderboard.service';
import { Stats } from '../../core/stats.service';
import { SyncService } from '../../core/sync.service';
import { gameInfo, PRACTICE_TRACKS } from '../../games/catalog';
import { PracticeStore } from '../../games/puzzle/practice.store';
import { MindStore } from '../../games/mind/mind-store';
import { SKILLS } from '../../games/catalog';
import { activityFrom } from '../challenges/challenges.service';

const WEEKDAYS = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];

interface Insight {
  icon: string;
  title: string;
  text: string;
}

/** Plain-language observations about how you play, worked out on this device from your stats and practice history. */
@Component({
  selector: 'app-insights',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './insights.html',
  styleUrl: './insights.scss',
})
export class Insights implements OnInit {
  private readonly practice = inject(PracticeStore);
  private readonly sync = inject(SyncService);
  private readonly mind = inject(MindStore);
  readonly stats = input<Stats | null>(null);
  /** How many insights to show. */
  readonly limit = input(4);
  private readonly loaded = signal(0);

  private readonly all = computed<Insight[]>(() => {
    this.loaded();
    const out: Insight[] = [];
    const stats = this.stats();
    const activity = activityFrom(this.sync.events(), stats, this.mind.plays());
    const name = (id: string) => gameInfo(id)?.name ?? id;

    if (stats) {
      const top = [...stats.games].sort((a, b) => Math.max(b.best, b.current) - Math.max(a.best, a.current))[0];
      if (top && Math.max(top.best, top.current) >= 2) out.push({ icon: '🔥', title: `${name(top.game)} is your streak game`, text: `Your longest run is ${Math.max(top.best, top.current)} days. ${top.current > 0 ? `You are on ${top.current} now.` : 'Start a new one today.'}` });
      const solver = [...stats.games].sort((a, b) => b.solved - a.solved)[0];
      if (solver && solver.solved >= 3) out.push({ icon: '📅', title: `You solve ${name(solver.game)} dailies most`, text: `${solver.solved} solved in total.` });
      const quick = stats.games.filter((g) => g.bestMs !== null && g.averageMs !== null && g.averageMs > g.bestMs * 1.15).sort((a, b) => b.averageMs! / b.bestMs! - a.averageMs! / a.bestMs!)[0];
      if (quick) out.push({ icon: '⏱️', title: `Your best ${name(quick.game)} is ${formatDuration(quick.bestMs!)}`, text: `Your average is ${formatDuration(quick.averageMs!)}. You have the speed in you.` });
      const next = [...stats.games].filter((g) => g.freezes < stats.rewards.maxFreezes).sort((a, b) => a.nextFreezeIn - b.nextFreezeIn)[0];
      if (next && next.nextFreezeIn > 0 && next.nextFreezeIn <= 4) out.push({ icon: '❄️', title: `${next.nextFreezeIn} more ${next.nextFreezeIn === 1 ? 'day' : 'days'} of ${name(next.game)} earns a freeze`, text: 'A freeze saves your streak on a day you miss.' });
    }

    const days = activity.filter((a) => a.kind !== 'mind');
    if (days.length >= 8) {
      const counts = new Array<number>(7).fill(0);
      for (const a of days) counts[a.at.getDay()]++;
      const best = counts.indexOf(Math.max(...counts));
      out.push({ icon: '🗓️', title: `You play most on ${WEEKDAYS[best]}`, text: `${counts[best]} of your last ${days.length} solves.` });
      const hours = days.filter((a) => a.kind === 'practice').map((a) => a.at.getHours());
      if (hours.length >= 8) {
        const morning = hours.filter((h) => h >= 5 && h < 12).length;
        const evening = hours.filter((h) => h >= 17 && h < 23).length;
        const night = hours.length - morning - evening - hours.filter((h) => h >= 12 && h < 17).length;
        const top = Math.max(morning, evening, night);
        if (top === morning) out.push({ icon: '🌅', title: 'You are a morning solver', text: 'Most of your practice happens before noon.' });
        else if (top === evening) out.push({ icon: '🌆', title: 'You are an evening solver', text: 'Most of your practice happens after 5 pm.' });
        else if (top === night) out.push({ icon: '🌙', title: 'You are a night solver', text: 'Most of your practice happens late at night.' });
      }
    }

    // Mind training: your strongest and your weakest skill.
    if (this.mind.totalPlays() >= 3) {
      const played = this.mind.skills().filter((s) => s.played > 0).sort((a, b) => b.mark - a.mark);
      const top = played[0];
      const low = this.mind.skills().filter((s) => s.mark === 0)[0];
      const label = (id: string) => SKILLS.find((s) => s.id === id)?.name.toLowerCase() ?? id;
      if (top && top.mark > 0) out.push({ icon: '🧠', title: `Your sharpest skill is ${label(top.skill)}`, text: low ? `You have not tried ${label(low.skill)} yet. Give it a go in Practice.` : `Mark ${top.mark} out of 100.` });
    }

    // Practice: how much help you take.
    let solved = 0;
    let hinted = 0;
    for (const t of PRACTICE_TRACKS) {
      const set = this.practice.solvedLevels(t.track)();
      solved += set.size;
      for (const l of set) if (this.practice.isHinted(t.track, l)) hinted++;
    }
    if (solved >= 10) {
      const clean = Math.round(((solved - hinted) / solved) * 100);
      out.push({ icon: '🧠', title: `${clean}% of your levels need no hint`, text: clean >= 90 ? 'You mostly think it through yourself. Try a harder tier.' : 'Hints are there to learn from. Try to spot the idea first.' });
    }
    return out;
  });

  protected readonly shown = computed(() => this.all().slice(0, this.limit()));

  ngOnInit(): void {
    for (const t of PRACTICE_TRACKS) void this.practice.load(t.track).then(() => this.loaded.update((n) => n + 1));
  }
}
