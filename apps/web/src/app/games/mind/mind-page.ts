import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { BackService } from '../../core/back.service';
import { HapticsService } from '../../core/haptics.service';
import { gameInfo, SKILLS } from '../catalog';
import { Glyph } from '../../shared/glyph';
import { AnagramRush } from './anagram-rush';
import { BackTrack } from './back-track';
import { ColourClash } from './colour-clash';
import { EchoSequence } from './echo-sequence';
import { GridRecall } from './grid-recall';
import { MIND_META } from './mind-meta';
import { MindStore } from './mind-store';
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
import { MindGameId } from '../catalog';

/** One screen for every mind-training game: how to play, the game, then your score against your best. */
@Component({
  selector: 'app-mind-page',
  imports: [RouterLink, Glyph, QuickSums, ColourClash, EchoSequence, GridRecall, NumberRecall, QuickReflex, OddOneOut, SpotChange, TargetTap, BackTrack, PairMatch, AnagramRush, MissingLetters, WhatNext, TargetNumber],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="top">
      <a class="round" href="/practice" aria-label="Back" (click)="nav.up($event)">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
      </a>
      <div class="title">
        <h1>{{ info()?.name }}</h1>
        <p class="muted">{{ skill()?.emoji }} {{ skill()?.name }}</p>
      </div>
    </header>

    @if (meta(); as m) {
      @switch (stage()) {
        @case ('intro') {
          <section class="card intro" [style.--h]="info()?.hue">
            <span class="art"><app-glyph [game]="id()" /></span>
            <p>{{ m.how }}</p>
            <dl>
              <div><dt>Best</dt><dd>{{ best() }}</dd></div>
              <div><dt>Plays</dt><dd>{{ store.record(id()).plays }}</dd></div>
            </dl>
            <button type="button" (click)="start()">Start</button>
          </section>
        }
        @case ('play') {
          <section class="stage">
            @switch (id()) {
              @case ('quick-sums') { <app-quick-sums (done)="finish($event)" /> }
              @case ('colour-clash') { <app-colour-clash (done)="finish($event)" /> }
              @case ('echo-sequence') { <app-echo-sequence (done)="finish($event)" /> }
              @case ('grid-recall') { <app-grid-recall (done)="finish($event)" /> }
              @case ('number-recall') { <app-number-recall (done)="finish($event)" /> }
              @case ('quick-reflex') { <app-quick-reflex (done)="finish($event)" /> }
              @case ('odd-one-out') { <app-odd-one-out (done)="finish($event)" /> }
              @case ('spot-change') { <app-spot-change (done)="finish($event)" /> }
              @case ('target-tap') { <app-target-tap (done)="finish($event)" /> }
              @case ('back-track') { <app-back-track (done)="finish($event)" /> }
              @case ('pair-match') { <app-pair-match (done)="finish($event)" /> }
              @case ('anagram-rush') { <app-anagram-rush (done)="finish($event)" /> }
              @case ('missing-letters') { <app-missing-letters (done)="finish($event)" /> }
              @case ('what-next') { <app-what-next (done)="finish($event)" /> }
              @case ('target-number') { <app-target-number (done)="finish($event)" /> }
            }
          </section>
        }
        @case ('result') {
          <section class="card result" [style.--h]="info()?.hue">
            @if (record()) {
              <p class="new">New best!</p>
            }
            <p class="big">{{ label(result()?.score ?? 0) }}</p>
            @if (result()?.detail; as d) {
              <p class="muted">{{ d }}</p>
            }
            <p class="muted">Best: {{ best() }}</p>
            <div class="row">
              <button type="button" (click)="start()">Play again</button>
              <a class="button secondary" routerLink="/practice">Practice</a>
            </div>
          </section>
        }
      }
    }
  `,
  styles: `
    :host {
      display: block;
      max-width: 30rem;
      margin: 0 auto;
      padding-bottom: 6rem;
    }
    .top {
      display: flex;
      align-items: center;
      gap: 0.8rem;
      margin-bottom: 1rem;
    }
    .title h1 {
      margin: 0;
      font-size: 1.4rem;
    }
    .title p {
      margin: 0;
    }
    .round {
      display: grid;
      place-items: center;
      width: 2.6rem;
      height: 2.6rem;
      border-radius: 50%;
      background: var(--surface);
      border: 1px solid var(--border);
      color: var(--text);
    }
    .round svg {
      width: 1.3rem;
      height: 1.3rem;
      fill: none;
      stroke: currentColor;
      stroke-width: 2.2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .card {
      display: grid;
      justify-items: center;
      gap: 0.9rem;
      padding: 1.4rem;
      text-align: center;
      border-radius: var(--radius);
      border: 1px solid var(--border);
      background: var(--surface);
    }
    .art {
      width: 4.5rem;
      height: 4.5rem;
      padding: 0.8rem;
      border-radius: 20px;
      background: oklch(var(--tile-l) var(--tile-c) calc(var(--h) * 1deg));
      color: oklch(var(--glyph-l) var(--glyph-c) calc(var(--h) * 1deg));
    }
    p {
      margin: 0;
    }
    dl {
      display: flex;
      gap: 1.5rem;
      margin: 0;
    }
    dt {
      font-size: 0.75rem;
      color: var(--muted);
    }
    dd {
      margin: 0;
      font-size: 1.3rem;
      font-weight: 700;
    }
    .stage {
      display: grid;
      justify-items: center;
    }
    .big {
      font-family: var(--font-display);
      font-size: 2.4rem;
      font-weight: 700;
    }
    .new {
      padding: 0.15rem 0.8rem;
      border-radius: 999px;
      background: #f5b82e;
      color: #3b2a00;
      font-weight: 800;
    }
    .row {
      display: flex;
      gap: 0.6rem;
    }
  `,
})
export class MindPage {
  protected readonly nav = inject(BackService);
  protected readonly store = inject(MindStore);
  private readonly haptics = inject(HapticsService);
  private readonly route = inject(ActivatedRoute);

  protected readonly id = toSignal(this.route.paramMap.pipe(map((p) => (p.get('game') ?? '') as MindGameId)), { initialValue: '' as MindGameId });
  protected readonly info = computed(() => gameInfo(this.id()));
  protected readonly meta = computed(() => MIND_META[this.id()]);
  protected readonly skill = computed(() => SKILLS.find((s) => s.id === this.meta()?.skill));
  protected readonly stage = signal<'intro' | 'play' | 'result'>('intro');
  protected readonly result = signal<MindResult | null>(null);
  protected readonly record = signal(false);
  protected readonly best = computed(() => this.label(this.store.record(this.id()).best, true));

  protected label(score: number, short = false): string {
    const m = this.meta();
    if (!m) return String(score);
    if (short && score === 0 && this.store.record(this.id()).plays === 0) return '–';
    return m.format ? m.format(score) : `${score} ${m.unit}`;
  }

  protected start(): void {
    this.result.set(null);
    this.record.set(false);
    this.stage.set('play');
  }

  protected finish(r: MindResult): void {
    this.result.set(r);
    this.record.set(this.store.add(this.id(), r.score) && r.score > 0);
    if (this.record()) this.haptics.success();
    this.stage.set('result');
  }
}
