import './styles.css';
import { Game } from './game/Game';

function showFileProtocolWarning(): void {
  const banner = document.createElement('div');
  banner.style.cssText =
    'position:fixed;inset:0;display:grid;place-items:center;background:#0a0a12;color:#f2f2ff;font-family:system-ui;z-index:9999;padding:2rem;text-align:center';
  banner.innerHTML = `
    <div>
      <h1 style="color:#ff2bd6">Neon Grounds</h1>
      <p>This game must be served over HTTP (ES modules).</p>
      <p style="color:#9aa0c0">From the project folder run:</p>
      <pre style="background:#16162a;padding:1rem;border-radius:8px">npm install
npm run dev</pre>
      <p style="color:#9aa0c0">Then open the URL Vite prints (usually http://localhost:5173).</p>
    </div>
  `;
  document.body.appendChild(banner);
}

function boot(): void {
  if (location.protocol === 'file:') {
    showFileProtocolWarning();
    return;
  }

  const canvas = document.getElementById('game-canvas');
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('Missing #game-canvas');
  }
  // Expose for automated verification / debugging
  const game = new Game(canvas);
  (window as unknown as { __NEON_GROUNDS__: Game }).__NEON_GROUNDS__ = game;
}

boot();
