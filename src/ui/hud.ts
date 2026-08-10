import { GENRE_STAGES, WORLD_HALF, WIN_HERD_RATIO } from '../logic/constants';
import { formatTimer } from '../logic/herding';

export type HudCallbacks = {
  onVolume: (v: number) => void;
  onRestart: () => void;
};

export class Hud {
  private gate = el<HTMLElement>('overlay-gate');
  private btnEnter = el<HTMLButtonElement>('btn-enter');
  private hud = el<HTMLElement>('hud');
  private timerEl = el<HTMLElement>('hud-timer');
  private herdEl = el<HTMLElement>('hud-herd');
  private statusEl = el<HTMLElement>('hud-status');
  private vol = el<HTMLInputElement>('master-vol');
  private prompt = el<HTMLElement>('interact-prompt');
  private help = el<HTMLElement>('help-panel');
  private toast = el<HTMLElement>('toast');
  private minimap = el<HTMLCanvasElement>('minimap');
  private minimapCtx: CanvasRenderingContext2D;
  private endScreen = el<HTMLElement>('end-screen');
  private endTitle = el<HTMLElement>('end-title');
  private endBody = el<HTMLElement>('end-body');
  private btnRestart = el<HTMLButtonElement>('btn-restart');

  constructor(private cb: HudCallbacks) {
    this.minimapCtx = this.minimap.getContext('2d')!;
    this.vol.addEventListener('input', () => this.cb.onVolume(Number(this.vol.value)));
    this.btnRestart.addEventListener('click', () => this.cb.onRestart());
  }

  onEnter(handler: () => void): void {
    this.btnEnter.addEventListener('click', handler);
  }

  hideGate(): void {
    this.gate.classList.add('hidden');
    this.hud.classList.remove('hidden');
  }

  setMission(timeLeft: number, herded: number, total: number, ratio: number): void {
    this.timerEl.textContent = formatTimer(timeLeft);
    this.timerEl.classList.toggle('urgent', timeLeft < 60);
    const pct = Math.floor(ratio * 100);
    const need = Math.floor(WIN_HERD_RATIO * 100);
    this.herdEl.textContent = `Herded ${herded}/${total} (${pct}%) · need ${need}%`;
    this.herdEl.classList.toggle('good', ratio >= WIN_HERD_RATIO);
  }

  setStatus(text: string): void {
    this.statusEl.textContent = text;
  }

  setPrompt(text: string | null): void {
    if (!text) {
      this.prompt.classList.add('hidden');
      return;
    }
    this.prompt.textContent = text;
    this.prompt.classList.remove('hidden');
  }

  toggleHelp(): void {
    this.help.classList.toggle('hidden');
  }

  showToast(msg: string, ms = 2200): void {
    this.toast.textContent = msg;
    this.toast.classList.remove('hidden');
    window.setTimeout(() => this.toast.classList.add('hidden'), ms);
  }

  showEnd(won: boolean, herded: number, total: number): void {
    this.endScreen.classList.remove('hidden');
    if (won) {
      this.endTitle.textContent = 'STAGES SECURED';
      this.endBody.textContent = `You herded ${herded}/${total} ravers in time. The headliner can start. Radio crackles: "Copy… somehow that worked."`;
    } else {
      this.endTitle.textContent = 'TOO LATE';
      this.endBody.textContent = `Only ${herded}/${total} made it to the stages. The DJ waits. Somewhere a glow stick is still going the wrong way.`;
    }
  }

  hideEnd(): void {
    this.endScreen.classList.add('hidden');
  }

  drawMinimap(
    playerX: number,
    playerZ: number,
    yaw: number,
    agents: readonly { x: number; z: number }[],
  ): void {
    const ctx = this.minimapCtx;
    const w = this.minimap.width;
    const h = this.minimap.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#1a140c';
    ctx.fillRect(0, 0, w, h);

    const scale = (w * 0.42) / WORLD_HALF;
    const toMap = (x: number, z: number) => ({
      mx: w / 2 + x * scale,
      my: h / 2 + z * scale,
    });

    // Stage zones
    for (const s of GENRE_STAGES) {
      const m = toMap(s.x, s.z + 8);
      ctx.fillStyle = `#${s.color.toString(16).padStart(6, '0')}55`;
      ctx.beginPath();
      ctx.arc(m.mx, m.my, s.zoneRadius * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `#${s.color.toString(16).padStart(6, '0')}`;
      ctx.beginPath();
      ctx.arc(m.mx, m.my, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Agents (sample for perf)
    ctx.fillStyle = '#ff66cc';
    for (let i = 0; i < agents.length; i += 4) {
      const a = agents[i]!;
      const m = toMap(a.x, a.z);
      ctx.fillRect(m.mx - 1, m.my - 1, 2, 2);
    }

    const pm = toMap(playerX, playerZ);
    ctx.save();
    ctx.translate(pm.mx, pm.my);
    ctx.rotate(yaw);
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(4, 4);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node as T;
}
