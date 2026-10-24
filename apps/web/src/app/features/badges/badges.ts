import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { Stats, StatsService } from '../../core/stats.service';
import { DAILY_GAMES, PRACTICE_TRACKS, SPEED_GAMES } from '../../games/catalog';
import { PracticeStore } from '../../games/puzzle/practice.store';
import { SyncService } from '../../core/sync.service';
import { MindStore } from '../../games/mind/mind-store';
import { MindDailyService } from '../../games/mind/mind-daily';
import { MIND_LIVE } from '../../games/catalog';
import { MIND_META } from '../../games/mind/mind-meta';
import { MindGameId } from '../../games/catalog';
import { HintsService, FREE_CAP } from '../../core/hints.service';
import { WalletService } from '../../core/wallet.service';
import { SupportService } from '../../core/support.service';
import { ChallengesService, activityFrom } from '../challenges/challenges.service';

const CLAIMED_KEY = 'zenigma.badges.claimed';
/** The hard ones pay 3 hints, the good ones 1; every badge pays 5 coins (the supporter badges are a thank-you and pay nothing). */
const HARD = new Set(['lv1000', 'lv2500', 'streak100', 'daily200', 'clean100', 'insane1', 'mindall', 'brain100', 'chal50']);
const EASY = new Set(['first', 'lv10', 'boss', 'early', 'owl', 'mind3', 'chal1']);
export function rewardOf(id: string): { coins: number; hints: number } {
  if (id.startsWith('sup')) return { coins: 0, hints: 0 };
  return { coins: 5, hints: HARD.has(id) ? 3 : EASY.has(id) ? 0 : 1 };
}

interface Badge {
  id: string;
  icon: string;
  name: string;
  text: string;
  have: number;
  need: number;
}

/** Badges earned just by playing: streaks, levels and a few small firsts. Worked out on this device from your progress. */
@Component({
  selector: 'app-badges',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './badges.html',
  styleUrl: './badges.scss',
})
export class Badges implements OnInit {
  private readonly practice = inject(PracticeStore);
  private readonly auth = inject(AuthService);
  private readonly statsApi = inject(StatsService);
  private readonly sync = inject(SyncService);
  private readonly mind = inject(MindStore);
  private readonly mindDaily = inject(MindDailyService);
  private readonly challenges = inject(ChallengesService);
  private readonly wallet = inject(WalletService);
  private readonly support = inject(SupportService);
  protected readonly hints = inject(HintsService);
  protected readonly claimed = signal<string[]>(this.readClaimed());
  protected readonly reward = rewardOf;
  private readonly stats = signal<Stats | null>(null);
  private readonly loaded = signal(0);

  protected readonly badges = computed<Badge[]>(() => {
    this.loaded();
    const stats = this.stats();
    const bestStreak = Math.max(0, ...(stats?.games.map((g) => Math.max(g.best, g.current)) ?? [0]));
    const dailiesPlayed = DAILY_GAMES.filter((g) => (stats?.games.find((s) => s.game === g.id)?.solved ?? 0) > 0).length;
    const dailySolved = stats?.games.reduce((n, g) => n + g.solved, 0) ?? 0;
    let speedWins = 0;
    for (const g of SPEED_GAMES) {
      try {
        const best = JSON.parse(localStorage.getItem(`zenigma.speed.${g}`) ?? 'null') as { solved: number } | null;
        if (best && best.solved >= 5) speedWins++;
      } catch {
        /* no storage: no speed badge */
      }
    }
    let levels = 0;
    let clean = 0;
    let bosses = 0;
    const gamesWithLevels = new Set<string>();
    for (const t of PRACTICE_TRACKS) {
      const solved = [...this.practice.solvedLevels(t.track)()];
      levels += solved.length;
      clean += solved.filter((l) => !this.practice.isHinted(t.track, l)).length;
      bosses += solved.filter((l) => l % 10 === 0).length;
      if (solved.length) gamesWithLevels.add(t.game);
    }
    // Things only the event log knows: when and what kind of puzzle was solved.
    const activity = activityFrom(this.sync.events(), stats, this.mind.plays());
    const excellent = (Object.keys(MIND_META) as MindGameId[]).filter((id) => this.mind.record(id).best >= MIND_META[id]!.scale).length;
    const practice = activity.filter((a) => a.kind === 'practice');
    const perGame = (g: string) => new Set(practice.filter((a) => a.game === g).map((a) => a.id)).size;
    const kinds = new Set(practice.filter((a) => a.game === 'sudoku').map((a) => (a.variant ?? '').replace(/-(easy|medium|hard|challenging|insane)$/, '')));
    const hardSudoku = new Set(practice.filter((a) => a.game === 'sudoku' && /-(hard|challenging|insane)$/.test(a.variant ?? '')).map((a) => a.id)).size;
    const insane = new Set(practice.filter((a) => a.game === 'sudoku' && /-insane$/.test(a.variant ?? '')).map((a) => a.id)).size;
    const words = new Set(practice.filter((a) => a.game === 'word-guess').map((a) => a.id)).size;
    const earlyBird = activity.filter((a) => a.kind === 'practice' && a.at.getHours() >= 4 && a.at.getHours() < 7).length;
    const nightOwl = activity.filter((a) => a.kind === 'practice' && (a.at.getHours() >= 23 || a.at.getHours() < 4)).length;
    const days = new Set(activity.map((a) => `${a.at.getFullYear()}-${a.at.getMonth()}-${a.at.getDate()}`));
    const perDay = new Map<string, Set<string>>();
    for (const a of practice) {
      const k = `${a.at.getFullYear()}-${a.at.getMonth()}-${a.at.getDate()}`;
      perDay.set(k, (perDay.get(k) ?? new Set()).add(a.id));
    }
    const bigDay = Math.max(0, ...[...perDay.values()].map((v) => v.size));
    // A weekend counts when you played on both its Saturday and its Sunday.
    const weekendDays = new Map<string, Set<number>>();
    for (const a of activity) {
      const wd = a.at.getDay();
      if (wd !== 6 && wd !== 0) continue;
      const sat = new Date(a.at.getFullYear(), a.at.getMonth(), a.at.getDate() - (wd === 0 ? 1 : 0));
      const k = `${sat.getFullYear()}-${sat.getMonth()}-${sat.getDate()}`;
      weekendDays.set(k, (weekendDays.get(k) ?? new Set()).add(wd));
    }
    const fullWeekends = [...weekendDays.values()].filter((v) => v.size === 2).length;
    const collected = this.challenges.collected();
    const cleanAll = activity.filter((a) => a.kind === 'practice' && a.clean === true).length;
    // A day on which every daily game was solved.
    const dayCounts = new Map<string, number>();
    for (const g of stats?.games ?? []) for (const d of g.recent) dayCounts.set(d, (dayCounts.get(d) ?? 0) + 1);
    const perfectDays = [...dayCounts.values()].filter((n) => n >= DAILY_GAMES.length).length;
    return [
      { id: 'first', icon: '🌱', name: 'First steps', text: 'Solve your first puzzle', have: levels + dailySolved, need: 1 },
      { id: 'lv10', icon: '🔟', name: 'Ten levels', text: 'Clear 10 practice levels', have: levels, need: 10 },
      { id: 'lv100', icon: '💯', name: 'Centurion', text: 'Clear 100 practice levels', have: levels, need: 100 },
      { id: 'lv500', icon: '🏔️', name: 'Mountaineer', text: 'Clear 500 practice levels', have: levels, need: 500 },
      { id: 'lv1000', icon: '🚀', name: 'Marathoner', text: 'Clear 1,000 practice levels', have: levels, need: 1000 },
      { id: 'speed', icon: '⚡', name: 'Speed demon', text: 'Solve all five levels of a speed round', have: speedWins, need: 1 },
      { id: 'boss', icon: '👑', name: 'Zone boss', text: 'Clear a 10th level', have: bosses, need: 1 },
      { id: 'clean', icon: '🧠', name: 'No help needed', text: 'Clear 25 levels without a hint', have: clean, need: 25 },
      { id: 'all', icon: '🎲', name: 'Collector', text: 'Clear a level in every puzzle game', have: gamesWithLevels.size, need: 5 },
      { id: 'streak7', icon: '🔥', name: 'One week', text: 'A 7-day streak in any game', have: bestStreak, need: 7 },
      { id: 'streak30', icon: '🌋', name: 'Habit', text: 'A 30-day streak in any game', have: bestStreak, need: 30 },
      { id: 'streak100', icon: '☄️', name: 'Unstoppable', text: 'A 100-day streak in any game', have: bestStreak, need: 100 },
      { id: 'allDaily', icon: '📅', name: 'Daily sampler', text: 'Solve a daily in every game', have: dailiesPlayed, need: DAILY_GAMES.length },
      { id: 'perfect', icon: '🌟', name: 'Perfect day', text: 'Solve every daily game in one day', have: perfectDays, need: 1 },
      { id: 'daily50', icon: '🏅', name: 'Regular', text: 'Solve 50 dailies in total', have: dailySolved, need: 50 },
      { id: 'daily200', icon: '🏆', name: 'Daily legend', text: 'Solve 200 dailies in total', have: dailySolved, need: 200 },
      { id: 'lv250', icon: '🥉', name: 'Quarter thousand', text: 'Clear 250 practice levels', have: levels, need: 250 },
      { id: 'lv2500', icon: '🌌', name: 'Cosmic', text: 'Clear 2,500 practice levels', have: levels, need: 2500 },
      { id: 'queens50', icon: '👸', name: 'Queen bee', text: 'Clear 50 Crowns levels', have: perGame('queens'), need: 50 },
      { id: 'tango50', icon: '☯️', name: 'Eclipse chaser', text: 'Clear 50 Eclipse levels', have: perGame('tango'), need: 50 },
      { id: 'zip50', icon: '🧵', name: 'Zipline pro', text: 'Clear 50 Zipline levels', have: perGame('zip'), need: 50 },
      { id: 'patches50', icon: '🧱', name: 'Patch pro', text: 'Clear 50 Patchwork levels', have: perGame('patches'), need: 50 },
      { id: 'sudoku100', icon: '🔢', name: 'Sudoku fan', text: 'Clear 100 Sudoku levels', have: perGame('sudoku'), need: 100 },
      { id: 'hard25', icon: '💎', name: 'Hard head', text: 'Clear 25 Sudoku levels on Hard or above', have: hardSudoku, need: 25 },
      { id: 'insane1', icon: '🤯', name: 'Insane in the brain', text: 'Clear an Insane Sudoku level', have: insane, need: 1 },
      { id: 'kinds4', icon: '🧭', name: 'Kind collector', text: 'Solve Sudoku in 4 different kinds', have: kinds.size, need: 4 },
      { id: 'kinds6', icon: '🗺️', name: 'Sudoku atlas', text: 'Solve Sudoku in 6 different kinds', have: kinds.size, need: 6 },
      { id: 'words10', icon: '🔤', name: 'Word wizard', text: 'Win 10 Word Guess practice games', have: words, need: 10 },
      { id: 'clean100', icon: '✨', name: 'Pure thinker', text: 'Clear 100 levels without a hint', have: cleanAll, need: 100 },
      { id: 'early', icon: '🌅', name: 'Early bird', text: 'Clear 3 levels between 4 and 7 in the morning', have: earlyBird, need: 3 },
      { id: 'owl', icon: '🦉', name: 'Night owl', text: 'Clear 3 levels between 11 at night and 4 in the morning', have: nightOwl, need: 3 },
      { id: 'weekend3', icon: '🏖️', name: 'Weekend warrior', text: 'Play on both days of 3 weekends', have: fullWeekends, need: 3 },
      { id: 'bigday', icon: '🎢', name: 'Big day', text: 'Clear 20 levels in one day', have: bigDay, need: 20 },
      { id: 'days30', icon: '🗓️', name: 'Thirty days', text: 'Play on 30 different days', have: days.size, need: 30 },
      { id: 'mind3', icon: '🧠', name: 'Warm-up', text: 'Play 3 different mind-training games', have: this.mind.gamesPlayed(), need: 3 },
      { id: 'mind10', icon: '🏋️', name: 'Brain gym', text: 'Play 10 different mind-training games', have: this.mind.gamesPlayed(), need: 10 },
      { id: 'mind50', icon: '🧬', name: 'Regular trainee', text: 'Play 50 mind-training games', have: this.mind.totalPlays(), need: 50 },
      { id: 'sharp', icon: '🎓', name: 'Sharp', text: 'Reach an excellent score in a mind game', have: excellent, need: 1 },
      { id: 'allskills', icon: '🌈', name: 'All-rounder', text: 'Play a game in each of the six mind skills', have: this.mind.skills().filter((s) => s.played > 0).length, need: 6 },
      { id: 'brain100', icon: '💡', name: 'Brain 100', text: 'Get all six mind skills above 60', have: this.mind.skills().filter((s) => s.mark > 60).length, need: 6 },
      { id: 'mindall', icon: '🧩', name: 'Whole gym', text: 'Play every mind-training game', have: this.mind.gamesPlayed(), need: MIND_LIVE.length },
      { id: 'mindstreak3', icon: '🔥', name: 'Mind streak', text: 'Finish the daily mind set 3 days running', have: this.mindDaily.streak(), need: 3 },
      { id: 'mindstreak7', icon: '☄️', name: 'Mind marathon', text: 'Finish the daily mind set 7 days running', have: this.mindDaily.streak(), need: 7 },
      { id: 'sharp5', icon: '🧠', name: 'Razor sharp', text: 'Reach an excellent score in 5 mind games', have: excellent, need: 5 },
      { id: 'sup1', icon: '💖', name: 'Supporter', text: 'Chip in for the servers', have: this.wallet.owned().has('badge:supporter') ? 1 : 0, need: 1 },
      { id: 'sup2', icon: '💎', name: 'Patron', text: 'Give ₹500 in total', have: this.wallet.owned().has('badge:patron') ? 1 : 0, need: 1 },
      { id: 'sup3', icon: '🏆', name: 'Champion', text: 'Give ₹2,000 in total', have: this.wallet.owned().has('badge:champion') ? 1 : 0, need: 1 },
      { id: 'chal1', icon: '🎯', name: 'Challenge accepted', text: 'Collect your first challenge reward', have: collected, need: 1 },
      { id: 'chal10', icon: '🏁', name: 'Challenge hunter', text: 'Collect 10 challenge rewards', have: collected, need: 10 },
      { id: 'chal50', icon: '🥇', name: 'Challenge legend', text: 'Collect 50 challenge rewards', have: collected, need: 50 },
    ].filter((b) => !b.id.startsWith('sup') || this.support.canDonate() || !!this.wallet.supporterTier());
  });
  private static readonly GROUPS: [string, string[]][] = [
    ['Getting started', ['first', 'lv10', 'lv100', 'lv250', 'lv500', 'lv1000', 'lv2500', 'boss']],
    ['Games', ['all', 'queens50', 'tango50', 'zip50', 'patches50', 'words10', 'speed']],
    ['Sudoku', ['sudoku100', 'hard25', 'insane1', 'kinds4', 'kinds6']],
    ['Streaks and dailies', ['streak7', 'streak30', 'streak100', 'allDaily', 'perfect', 'daily50', 'daily200']],
    ['Habits', ['clean', 'clean100', 'early', 'owl', 'weekend3', 'bigday', 'days30']],
    ['Mind training', ['mind3', 'mind10', 'mind50', 'allskills', 'brain100', 'mindall', 'mindstreak3', 'mindstreak7', 'sharp', 'sharp5']],
    ['Challenges', ['chal1', 'chal10', 'chal50']],
    ['Supporters', ['sup1', 'sup2', 'sup3']],
  ];
  /** Badges in sections; inside each, the ones you have come first. */
  protected readonly groups = computed(() => {
    const all = this.badges();
    return Badges.GROUPS.filter(([name]) => name !== 'Supporters' || this.support.canDonate() || this.wallet.supporterTier()).map(([name, ids]) => {
      const items = ids.map((id) => all.find((b) => b.id === id)).filter((b): b is Badge => !!b);
      items.sort((a, b) => Number(b.have >= b.need) - Number(a.have >= a.need));
      return { name, items, earned: items.filter((b) => b.have >= b.need).length };
    }).filter((g) => g.items.length > 0);
  });
  protected readonly earned = computed(() => this.badges().filter((b) => b.have >= b.need).length);

  ngOnInit(): void {
    void this.challenges.load();
    for (const t of PRACTICE_TRACKS) void this.practice.load(t.track).then(() => this.loaded.update((n) => n + 1));
    if (this.auth.signedIn()) {
      // Saved stats first; refreshed only if the server is awake anyway, so opening Badges never wakes it.
      this.stats.set(this.statsApi.peek());
      void this.statsApi.refreshIfAwake().then((s) => s && this.stats.set(s)).catch(() => undefined);
    }
  }

  /** Earned badges whose reward has not been collected yet. */
  protected readonly waiting = computed(() => this.badges().filter((b) => b.have >= b.need && !this.claimed().includes(b.id) && (rewardOf(b.id).coins > 0)).length);

  /** True when a badge's hint reward would not fit in the stash (collect after using some hints). */
  protected blocked(b: Badge): boolean {
    return rewardOf(b.id).hints > 0 && this.hints.balance() > FREE_CAP - rewardOf(b.id).hints;
  }

  protected collect(b: Badge): void {
    const r = rewardOf(b.id);
    if (b.have < b.need || this.claimed().includes(b.id) || r.coins === 0 || this.blocked(b)) return;
    if (r.hints) this.hints.grant(r.hints, 'badge', `badge:${b.id}`);
    this.wallet.earn('badge', `badge:${b.id}`, `Badge: ${b.name}`);
    const next = [...this.claimed(), b.id];
    this.claimed.set(next);
    try {
      localStorage.setItem(CLAIMED_KEY, JSON.stringify(next));
    } catch {
      /* the reward is still paid once: the ref is unique */
    }
  }

  protected collectAll(): void {
    for (const b of this.badges()) this.collect(b);
  }

  private readClaimed(): string[] {
    try {
      const v = JSON.parse(localStorage.getItem(CLAIMED_KEY) ?? '[]') as unknown;
      return Array.isArray(v) ? (v as string[]) : [];
    } catch {
      return [];
    }
  }

  protected min(b: Badge): number {
    return Math.min(b.have, b.need);
  }
}
