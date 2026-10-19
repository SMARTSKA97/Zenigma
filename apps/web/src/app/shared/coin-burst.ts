import { ChangeDetectionStrategy, Component, effect, ElementRef, inject, untracked } from '@angular/core';
import { PrefsService } from '../core/prefs.service';
import { WalletService } from '../core/wallet.service';

/**
 * The coin reward: gold coins burst from the middle of the screen and fly up into the coin counter, the counter pops,
 * and a "+10" label floats. Sound is played by the wallet. Plain DOM and the Web Animations API, so it costs nothing while idle.
 */
@Component({
  selector: 'app-coin-burst',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 200;
      pointer-events: none;
      overflow: hidden;
    }
  `,
})
export class CoinBurst {
  private readonly wallet = inject(WalletService);
  private readonly prefs = inject(PrefsService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  constructor() {
    effect(() => {
      const burst = this.wallet.burst();
      if (burst) untracked(() => this.play(burst.amount, burst.label));
    });
  }

  private play(amount: number, label: string): void {
    if (typeof document === 'undefined') return;
    const chip = document.querySelector<HTMLElement>('.coin-chip');
    const target = chip?.getBoundingClientRect();
    const tx = target ? target.left + target.width / 2 : window.innerWidth - 50;
    const ty = target ? target.top + target.height / 2 : 30;
    const reduce = this.prefs.motionReduced();
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight * 0.55;

    this.label(`+${amount} 🪙`, label, cx, cy);
    if (reduce) {
      this.pop(chip);
      return;
    }
    const count = Math.min(14, Math.max(4, Math.round(amount / 3)));
    for (let i = 0; i < count; i++) {
      const el = document.createElement('span');
      el.textContent = '🪙';
      Object.assign(el.style, { position: 'absolute', left: `${cx}px`, top: `${cy}px`, fontSize: '1.6rem', willChange: 'transform, opacity' });
      this.host.appendChild(el);
      const angle = Math.random() * Math.PI * 2;
      const spread = 50 + Math.random() * 70;
      const bx = Math.cos(angle) * spread;
      const by = Math.sin(angle) * spread - 30;
      const delay = i * 35;
      const anim = el.animate(
        [
          { transform: 'translate(-50%,-50%) scale(0.3)', opacity: 0 },
          { transform: `translate(calc(-50% + ${bx}px), calc(-50% + ${by}px)) scale(1.1) rotate(${Math.random() * 360}deg)`, opacity: 1, offset: 0.3 },
          { transform: `translate(calc(-50% + ${tx - cx}px), calc(-50% + ${ty - cy}px)) scale(0.45)`, opacity: 0.9 },
        ],
        { duration: 900, delay, easing: 'cubic-bezier(0.5, 0, 0.3, 1)', fill: 'both' },
      );
      anim.onfinish = () => {
        el.remove();
        if (i % 3 === 0) this.pop(chip);
      };
    }
  }

  private label(big: string, small: string, x: number, y: number): void {
    const el = document.createElement('div');
    el.innerHTML = `<b style="font-size:1.9rem">${big}</b><div style="font-size:.85rem;opacity:.85">${small.replace(/[<>&]/g, '')}</div>`;
    Object.assign(el.style, {
      position: 'absolute',
      left: `${x}px`,
      top: `${y}px`,
      transform: 'translate(-50%,-50%)',
      textAlign: 'center',
      color: '#fff',
      textShadow: '0 2px 10px rgb(0 0 0 / .55)',
      fontFamily: 'var(--font-display)',
    });
    this.host.appendChild(el);
    const anim = el.animate(
      [
        { transform: 'translate(-50%,-30%) scale(.6)', opacity: 0 },
        { transform: 'translate(-50%,-60%) scale(1)', opacity: 1, offset: 0.2 },
        { transform: 'translate(-50%,-110%) scale(1)', opacity: 1, offset: 0.7 },
        { transform: 'translate(-50%,-140%) scale(.95)', opacity: 0 },
      ],
      { duration: 1500, easing: 'ease-out' },
    );
    anim.onfinish = () => el.remove();
  }

  private pop(chip: HTMLElement | null): void {
    chip?.classList.remove('pop');
    void chip?.offsetWidth;
    chip?.classList.add('pop');
  }
}
