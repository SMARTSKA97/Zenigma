import { WalletService } from '../../core/wallet.service';
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { BackService } from '../../core/back.service';
import { HapticsService } from '../../core/haptics.service';
import { gameInfo, SKILLS } from '../catalog';
import { Confetti } from '../../shared/confetti';
import { Glyph } from '../../shared/glyph';
import { AnagramRush } from './anagram-rush';
import { BackTrack } from './back-track';
import { ColourClash } from './colour-clash';
import { EchoSequence } from './echo-sequence';
import { GridRecall } from './grid-recall';
import { MIND_META } from './mind-meta';
import { MindStore } from './mind-store';
import { MindDailyService } from './mind-daily';
import { MindResult } from './mind-util';
import { MissingLetters } from './missing-letters';
import { NumberRecall } from './number-recall';
import { OddOneOut } from './odd-one-out';
import { PairMatch } from './pair-match';
import { QuickReflex } from './quick-reflex';
import { QuickSums } from './quick-sums';
import { SpotChange } from './spot-change';
import { TargetNumber } from './target-number';
import { TargetTap } from './target-tap';
import { WhatNext } from './what-next';
import { MentalTurn } from './mental-turn';
import { NumberSort } from './number-sort';
import { DotCount } from './dot-count';
import { Opposites } from './opposites';
import { WordRecall } from './word-recall';
import { ChainLink } from './chain-link';
import { Pinpoint } from './pinpoint';
import { Crossclimb } from './crossclimb';
import { Wend } from './wend';
import { CometSlice } from './comet-slice';
import { Switchyard } from './switchyard';
import { PlayScreen } from '../../shared/play-screen';
import { MindGameId } from '../catalog';
import { CanLeave } from '../../core/leave';
import { LeaveSheet } from '../../shared/leave-sheet';

/** One screen for every mind-training game: how to play, the game, then your score against your best. */
@Component({
  selector: 'app-mind-page',
  imports: [NgTemplateOutlet, Confetti, PlayScreen, RouterLink, Glyph, LeaveSheet, QuickSums, ColourClash, EchoSequence, GridRecall, NumberRecall, QuickReflex, OddOneOut, SpotChange, TargetTap, BackTrack, PairMatch, AnagramRush, MissingLetters, WhatNext, TargetNumber, MentalTurn, NumberSort, DotCount, Opposites, WordRecall, ChainLink, Pinpoint, Crossclimb, Wend, CometSlice, Switchyard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mind-page.html',
  styleUrl: './mind-page.scss',
})
export class MindPage implements CanLeave {
  protected readonly nav = inject(BackService);
  protected readonly store = inject(MindStore);
  protected readonly daily = inject(MindDailyService);
  private readonly wallet = inject(WalletService);
  private readonly haptics = inject(HapticsService);
  private readonly route = inject(ActivatedRoute);

  protected readonly id = toSignal(this.route.paramMap.pipe(map((p) => (p.get('game') ?? '') as MindGameId)), { initialValue: '' as MindGameId });
  protected readonly info = computed(() => gameInfo(this.id()));
  protected readonly meta = computed(() => MIND_META[this.id()]);
  protected readonly skill = computed(() => SKILLS.find((s) => s.id === this.meta()?.skill));
  /** These games draw their own full-screen layout (keyboard, board or sky); every other one is placed in the shared play screen. */
  protected readonly ownScreen = computed(() => ['wend', 'chain-link', 'crossclimb', 'pinpoint', 'comet-slice', 'switchyard'].includes(this.id()));
  protected readonly stage = signal<'intro' | 'play' | 'result'>('intro');
  protected readonly result = signal<MindResult | null>(null);
  protected readonly record = signal(false);
  protected readonly best = computed(() => this.label(this.store.record(this.id()).best, true));

  protected label(score: number, short = false): string {
    const m = this.meta();
    if (!m) return String(score);
    if (short && score === 0 && this.store.record(this.id()).plays === 0) return '–';
    return m.format ? m.format(score) : `${score} ${score === 1 ? m.unit.replace(/s$/, '') : m.unit}`;
  }

  protected readonly leaving = signal<((ok: boolean) => void) | null>(null);

  /** Mid-round, a stray Back asks first: a round cannot be picked up again. */
  canLeave(): boolean | Promise<boolean> {
    if (this.stage() !== 'play') return true;
    this.haptics.warning();
    return new Promise<boolean>((resolve) => this.leaving.set(resolve));
  }

  protected answerLeave(leave: boolean): void {
    const done = this.leaving();
    this.leaving.set(null);
    done?.(leave);
  }

  /** Every button press in a game gives a small tap, so each answer is felt even in games that do not buzz themselves. */
  protected feel(event: PointerEvent): void {
    if ((event.target as HTMLElement | null)?.closest('button')) this.haptics.tick();
  }

  protected start(): void {
    this.result.set(null);
    this.record.set(false);
    this.stage.set('play');
  }

  protected finish(r: MindResult): void {
    this.result.set(r);
    this.record.set(this.store.add(this.id(), r.score) && r.score > 0);
    // A game that is in today's mind set counts for it, wherever it was started from.
    this.daily.record(this.id(), r.score);
    this.haptics.success();
    this.wallet.note('mind');
    this.stage.set('result');
  }
}
