import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { AuthService } from '../core/auth.service';
import { PlayerService } from '../core/player.service';

/** The player's card: level, title and XP on the front, what the XP is made of on the back. Tap to flip, tilt with a finger or the pointer. */
@Component({
  selector: 'app-player-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="stage"
      (pointermove)="tilt($event)"
      (pointerleave)="rx.set(0); ry.set(0)"
      [style.--rx.deg]="rx()"
      [style.--ry.deg]="ry()"
    >
      <button type="button" class="card" [class.flipped]="flipped()" (click)="flipped.set(!flipped())" [attr.aria-label]="'Player card, level ' + p.progress().level + '. Tap to flip.'">
        <span class="face front">
          <span class="mosaic" aria-hidden="true">
            @for (c of mosaic; track $index) { <i [style.--c]="c"></i> }
          </span>
          <span class="top"><span class="brand">ZENIGMA PLAYER</span><span class="lv">LV {{ p.progress().level }}</span></span>
          <span class="mid">
            <span class="ring" [style.--p]="(p.progress().into / p.progress().span) * 100" aria-hidden="true"><b>{{ initial() }}</b></span>
            <span class="who">
              <strong>{{ name() }}</strong>
              <small>{{ p.title() }} · {{ p.xp() }} XP</small>
            </span>
          </span>
          <span class="foot">
            <span class="bar" role="progressbar" [attr.aria-valuenow]="p.progress().into" aria-valuemin="0" [attr.aria-valuemax]="p.progress().span"><i [style.width.%]="(p.progress().into / p.progress().span) * 100"></i></span>
            <small>{{ p.progress().span - p.progress().into }} XP to level {{ p.progress().level + 1 }}</small>
          </span>
        </span>
        <span class="face back">
          <span class="top"><span class="brand">WHERE YOUR XP COMES FROM</span></span>
          <dl>
            <div><dt>Levels cleared</dt><dd>{{ p.levelsCleared() }}<small>×10</small></dd></div>
            <div><dt>Dailies solved</dt><dd>{{ p.dailiesSolved() }}<small>×25</small></dd></div>
            <div><dt>Mind games played</dt><dd>{{ p.mindPlays() }}<small>×4</small></dd></div>
            <div><dt>Best streak</dt><dd>{{ p.bestStreak() }}<small>×10</small></dd></div>
          </dl>
          <small class="hint">Tap to flip back</small>
        </span>
      </button>
    </div>
  `,
  styles: `
    :host { display: block; }
    .stage { perspective: 900px; }
    .card {
      position: relative;
      display: block;
      width: 100%;
      min-height: 14.5rem;
      padding: 0;
      border: 0;
      border-radius: 28px;
      background: none;
      color: #fff;
      text-align: left;
      transform-style: preserve-3d;
      transform: rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg));
      transition: transform 0.5s var(--ease);
      box-shadow: var(--shadow-lift);
      cursor: pointer;
    }
    .card.flipped { transform: rotateX(var(--rx, 0deg)) rotateY(calc(180deg + var(--ry, 0deg))); }
    .face {
      position: absolute;
      inset: 0;
      display: grid;
      align-content: space-between;
      gap: 0.8rem;
      padding: 1.1rem 1.2rem;
      overflow: hidden;
      border-radius: 28px;
      backface-visibility: hidden;
      background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 80%, #000) 0%, #0f1618 70%);
    }
    .back { transform: rotateY(180deg); }
    .mosaic {
      position: absolute;
      right: -0.6rem;
      top: -0.6rem;
      display: grid;
      grid-template-columns: repeat(3, 1.5rem);
      gap: 4px;
      transform: rotate(12deg);
      opacity: 0.35;
    }
    .mosaic i { width: 1.5rem; height: 1.5rem; border-radius: 7px; background: var(--c); }
    .top { position: relative; display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
    .brand { font: 700 0.7rem/1 var(--font-body); letter-spacing: 0.14em; opacity: 0.85; }
    .lv { padding: 0.25rem 0.65rem; border-radius: 999px; background: #fff; color: #0f1618; font: 800 0.78rem/1 var(--font-body); }
    .mid { position: relative; display: flex; align-items: center; gap: 0.9rem; }
    .ring {
      display: grid;
      place-items: center;
      flex: none;
      width: 4.2rem;
      height: 4.2rem;
      border-radius: 50%;
      background: conic-gradient(#fff calc(var(--p) * 1%), rgb(255 255 255 / 0.2) 0);
    }
    .ring b {
      display: grid;
      place-items: center;
      width: calc(100% - 8px);
      height: calc(100% - 8px);
      border-radius: 50%;
      background: #0f1618;
      font: 800 1.5rem/1 var(--font-display);
    }
    .who { min-width: 0; display: grid; gap: 0.15rem; }
    .who strong { font: 700 1.25rem/1.15 var(--font-display); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .who small, .foot small, .hint { opacity: 0.8; font-size: 0.8rem; }
    .foot { position: relative; display: grid; gap: 0.35rem; }
    .bar { display: block; height: 8px; border-radius: 99px; background: rgb(255 255 255 / 0.2); overflow: hidden; }
    .bar i { display: block; height: 100%; border-radius: 99px; background: #fff; transition: width 0.6s var(--ease); }
    dl { position: relative; display: grid; gap: 0.45rem; margin: 0; }
    dl div { display: flex; justify-content: space-between; align-items: baseline; gap: 0.5rem; font-size: 0.92rem; }
    dt { opacity: 0.85; }
    dd { margin: 0; font: 700 1.05rem/1 var(--font-display); }
    dd small { margin-left: 0.3rem; font: 500 0.72rem var(--font-body); opacity: 0.7; }
    :root[data-motion='reduced'] .card { transition: none; transform: none; }
    :root[data-motion='reduced'] .card.flipped .front { display: none; }
    :root[data-motion='reduced'] .card:not(.flipped) .back { display: none; }
    :root[data-motion='reduced'] .back { transform: none; }
  `,
})
export class PlayerCard implements OnInit {
  protected readonly p = inject(PlayerService);
  private readonly auth = inject(AuthService);
  protected readonly flipped = signal(false);
  protected readonly rx = signal(0);
  protected readonly ry = signal(0);
  protected readonly mosaic = ['#e5484d', '#f5b82e', '#30a46c', '#3e63dd', '#8e4ec6', '#12a594', '#f76b15', '#d6409f', '#0090ff'];

  ngOnInit(): void {
    this.p.start();
  }

  protected name(): string {
    const u = this.auth.user();
    return u?.displayName || u?.email?.split('@')[0] || 'Player';
  }

  protected initial(): string {
    return this.name().trim().charAt(0).toUpperCase() || 'Z';
  }

  protected tilt(event: PointerEvent): void {
    if (event.pointerType === 'touch' && event.buttons === 0) return;
    const r = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.ry.set(((event.clientX - r.left) / r.width - 0.5) * 12);
    this.rx.set(-((event.clientY - r.top) / r.height - 0.5) * 10);
  }
}
