import {
  MODULE_TYPES,
  SEQUENCER_STEPS,
  SEQUENCER_TRACK_NAMES,
  type ModuleType,
} from '../logic/constants';
import type { SequencerState } from '../logic/sequencer';
import { GENRE_STAGES, PLOT_CENTER, WORLD_HALF } from '../logic/constants';

export type HudCallbacks = {
  onVolume: (v: number) => void;
  onSeqToggle: (track: number, step: number) => void;
  onSeqPlay: () => void;
  onSeqStop: () => void;
  onSeqClear: () => void;
  onSeqTempo: (bpm: number) => void;
  onBuildSelect: (type: ModuleType) => void;
  onLightApply: (color: string, mode: 'static' | 'pulse' | 'beat') => void;
  onLightClose: () => void;
};

export class Hud {
  private gate = el<HTMLElement>('overlay-gate');
  private btnEnter = el<HTMLButtonElement>('btn-enter');
  private hud = el<HTMLElement>('hud');
  private timeEl = el<HTMLElement>('hud-time');
  private weatherEl = el<HTMLElement>('hud-weather');
  private stageEl = el<HTMLElement>('hud-stage');
  private vol = el<HTMLInputElement>('master-vol');
  private prompt = el<HTMLElement>('interact-prompt');
  private help = el<HTMLElement>('help-panel');
  private buildPanel = el<HTMLElement>('build-panel');
  private palette = el<HTMLElement>('build-palette');
  private seqPanel = el<HTMLElement>('sequencer-panel');
  private seqGrid = el<HTMLElement>('seq-grid');
  private seqPlay = el<HTMLButtonElement>('seq-play');
  private seqStop = el<HTMLButtonElement>('seq-stop');
  private seqClear = el<HTMLButtonElement>('seq-clear');
  private seqTempo = el<HTMLInputElement>('seq-tempo');
  private lightPanel = el<HTMLElement>('light-panel');
  private lightColor = el<HTMLInputElement>('light-color');
  private lightMode = el<HTMLSelectElement>('light-mode');
  private lightApply = el<HTMLButtonElement>('light-apply');
  private lightClose = el<HTMLButtonElement>('light-close');
  private toast = el<HTMLElement>('toast');
  private minimap = el<HTMLCanvasElement>('minimap');
  private minimapCtx: CanvasRenderingContext2D;
  private selectedBuild: ModuleType = 'deck';
  private cellButtons: HTMLButtonElement[][] = [];

  constructor(private cb: HudCallbacks) {
    this.minimapCtx = this.minimap.getContext('2d')!;
    this.vol.addEventListener('input', () => this.cb.onVolume(Number(this.vol.value)));
    this.seqPlay.addEventListener('click', () => this.cb.onSeqPlay());
    this.seqStop.addEventListener('click', () => this.cb.onSeqStop());
    this.seqClear.addEventListener('click', () => this.cb.onSeqClear());
    this.seqTempo.addEventListener('change', () =>
      this.cb.onSeqTempo(Number(this.seqTempo.value)),
    );
    this.lightApply.addEventListener('click', () => {
      const mode = this.lightMode.value as 'static' | 'pulse' | 'beat';
      this.cb.onLightApply(this.lightColor.value, mode);
    });
    this.lightClose.addEventListener('click', () => this.cb.onLightClose());
    this.buildPalette();
    this.buildSeqGrid();
  }

  onEnter(handler: () => void): void {
    this.btnEnter.addEventListener('click', handler);
  }

  hideGate(): void {
    this.gate.classList.add('hidden');
    this.hud.classList.remove('hidden');
  }

  setTimeLabel(period: string, phase: number): void {
    const hours = Math.floor(((phase + 0.0) % 1) * 24);
    this.timeEl.textContent = `${period} · ${String(hours).padStart(2, '0')}:00`;
  }

  setWeather(label: string): void {
    this.weatherEl.textContent = label;
  }

  setStage(name: string): void {
    this.stageEl.textContent = name;
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

  setBuildMode(on: boolean): void {
    this.buildPanel.classList.toggle('hidden', !on);
  }

  setSequencerOpen(on: boolean): void {
    this.seqPanel.classList.toggle('hidden', !on);
  }

  setLightPanel(on: boolean, color?: string, mode?: string): void {
    this.lightPanel.classList.toggle('hidden', !on);
    if (color) this.lightColor.value = color;
    if (mode) this.lightMode.value = mode;
  }

  getSelectedBuild(): ModuleType {
    return this.selectedBuild;
  }

  showToast(msg: string, ms = 2000): void {
    this.toast.textContent = msg;
    this.toast.classList.remove('hidden');
    window.setTimeout(() => this.toast.classList.add('hidden'), ms);
  }

  syncSequencer(state: SequencerState, highlightStep = -1): void {
    this.seqTempo.value = String(state.tempo);
    for (let t = 0; t < state.tracks.length; t++) {
      for (let s = 0; s < SEQUENCER_STEPS; s++) {
        const btn = this.cellButtons[t]?.[s];
        if (!btn) continue;
        btn.classList.toggle('on', Boolean(state.tracks[t]?.[s]));
        btn.classList.toggle('beat', s === highlightStep);
      }
    }
  }

  drawMinimap(playerX: number, playerZ: number, yaw: number): void {
    const ctx = this.minimapCtx;
    const w = this.minimap.width;
    const h = this.minimap.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0c1020';
    ctx.fillRect(0, 0, w, h);

    const scale = (w * 0.42) / WORLD_HALF;
    const toMap = (x: number, z: number) => ({
      mx: w / 2 + x * scale,
      my: h / 2 + z * scale,
    });

    // paths ring
    ctx.strokeStyle = '#3a3040';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 70 * scale, 0, Math.PI * 2);
    ctx.stroke();

    // plaza
    ctx.fillStyle = '#4a4a60';
    const p = toMap(0, 0);
    ctx.beginPath();
    ctx.arc(p.mx, p.my, 5, 0, Math.PI * 2);
    ctx.fill();

    // stages
    for (const s of GENRE_STAGES) {
      const m = toMap(s.x, s.z);
      ctx.fillStyle = `#${s.color.toString(16).padStart(6, '0')}`;
      ctx.beginPath();
      ctx.arc(m.mx, m.my, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // plot
    const pl = toMap(PLOT_CENTER.x, PLOT_CENTER.z);
    ctx.strokeStyle = '#ff2bd6';
    ctx.strokeRect(pl.mx - 4, pl.my - 4, 8, 8);

    // player
    const pm = toMap(playerX, playerZ);
    ctx.save();
    ctx.translate(pm.mx, pm.my);
    ctx.rotate(yaw);
    ctx.fillStyle = '#2bfff0';
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(4, 4);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private buildPalette(): void {
    this.palette.innerHTML = '';
    for (const type of MODULE_TYPES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = labelModule(type);
      btn.dataset.type = type;
      if (type === this.selectedBuild) btn.classList.add('active');
      btn.addEventListener('click', () => {
        this.selectedBuild = type;
        this.cb.onBuildSelect(type);
        this.palette.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      });
      this.palette.appendChild(btn);
    }
  }

  private buildSeqGrid(): void {
    this.seqGrid.innerHTML = '';
    this.cellButtons = [];
    for (let t = 0; t < SEQUENCER_TRACK_NAMES.length; t++) {
      const label = document.createElement('div');
      label.className = 'seq-label';
      label.textContent = SEQUENCER_TRACK_NAMES[t]!;
      this.seqGrid.appendChild(label);
      const row: HTMLButtonElement[] = [];
      for (let s = 0; s < SEQUENCER_STEPS; s++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'seq-cell';
        btn.addEventListener('click', () => this.cb.onSeqToggle(t, s));
        this.seqGrid.appendChild(btn);
        row.push(btn);
      }
      this.cellButtons.push(row);
    }
  }
}

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node as T;
}

function labelModule(t: ModuleType): string {
  switch (t) {
    case 'deck':
      return '1 Deck';
    case 'speakers':
      return '2 Speakers';
    case 'lightPole':
      return '3 Light';
    case 'ledWall':
      return '4 LED';
    case 'dancefloor':
      return '5 Floor';
  }
}
