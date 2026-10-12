import './style.css';
import { Game } from './game';
import { registerSW } from 'virtual:pwa-register';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const game = new Game(canvas);
(window as unknown as { chronopolis: Game }).chronopolis = game;

// PWA: register the service worker and offer install.
registerSW({ immediate: true });

let deferredPrompt: (Event & { prompt: () => Promise<void> }) | null = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e as Event & { prompt: () => Promise<void> };
  const hint = document.getElementById('install-hint');
  if (hint) {
    hint.innerHTML = '<a href="#" id="install-link">Install Chronopolis</a> to play fullscreen and offline.';
    document.getElementById('install-link')?.addEventListener('click', (ev) => {
      ev.preventDefault();
      void deferredPrompt?.prompt();
    });
  }
});

// Try to lock to landscape on phones once the player has interacted.
const tryLock = (): void => {
  const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
  o.lock?.('landscape').catch(() => {});
  document.documentElement.requestFullscreen?.().catch(() => {});
  window.removeEventListener('touchend', tryLock);
};
if (matchMedia('(pointer: coarse)').matches) window.addEventListener('touchend', tryLock);

window.addEventListener('beforeunload', () => game.save());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) game.save();
});
