/**
 * Developer widget: one-click chronoport travel to any era plus live performance numbers.
 * Remove the DevTools construction in main.ts before shipping.
 */
import { ERAS } from '../eras';
import type { Game } from '../game';

export class DevTools {
  private stats: HTMLElement;
  private frames = 0;
  private last = performance.now();
  private open = true;

  constructor(game: Game) {
    const el = document.createElement('div');
    el.id = 'devtools';
    el.className = 'ui-block';
    el.innerHTML = `<div class="dev-head"><span>DEV</span><button class="dev-toggle" title="Toggle (backquote key)">&minus;</button></div>
      <div class="dev-stats"></div><div class="dev-eras"></div>`;
    document.body.appendChild(el);
    this.stats = el.querySelector('.dev-stats')!;
    const list = el.querySelector('.dev-eras')!;
    for (const era of ERAS) {
      const b = document.createElement('button');
      b.className = 'dev-era';
      b.textContent = `${era.yearLabel} ${era.civ}`;
      b.addEventListener('click', () => void game.debugTravel(era.id));
      list.appendChild(b);
    }
    const toggle = (): void => {
      this.open = !this.open;
      el.classList.toggle('collapsed', !this.open);
      (el.querySelector('.dev-toggle') as HTMLElement).textContent = this.open ? '−' : '+';
    };
    el.querySelector('.dev-toggle')!.addEventListener('click', toggle);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Backquote') toggle();
    });
    const tick = (): void => {
      this.frames++;
      const now = performance.now();
      if (now - this.last >= 500) {
        const fps = (this.frames * 1000) / (now - this.last);
        this.frames = 0;
        this.last = now;
        const d = game.debug();
        this.stats.textContent = `${fps.toFixed(0)} fps · ${(d.triangles / 1000).toFixed(0)}k tris · ${d.calls} calls · ${d.chunks} chunks · ${d.era} (${d.x.toFixed(0)}, ${d.z.toFixed(0)})`;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}
