import {
  BUILD_GRID,
  BUILD_MAX_MODULES,
  MODULE_TYPES,
  PLOT_CENTER,
  PLOT_HALF,
  type ModuleType,
} from './constants';
import type { SequencerState } from './sequencer';
import { createEmptySequencer } from './sequencer';

export type StageModule = {
  id: string;
  type: ModuleType;
  x: number;
  z: number;
  rotY: number;
  color?: string;
  lightMode?: 'static' | 'pulse' | 'beat';
};

export type PlayerStageState = {
  modules: StageModule[];
  sequencer: SequencerState;
};

export function createPlayerStage(): PlayerStageState {
  return {
    modules: [],
    sequencer: createEmptySequencer(),
  };
}

export function isModuleType(v: string): v is ModuleType {
  return (MODULE_TYPES as readonly string[]).includes(v);
}

export function snapToGrid(v: number, grid = BUILD_GRID): number {
  return Math.round(v / grid) * grid;
}

export function inPlot(x: number, z: number): boolean {
  return (
    Math.abs(x - PLOT_CENTER.x) <= PLOT_HALF &&
    Math.abs(z - PLOT_CENTER.z) <= PLOT_HALF
  );
}

export function canPlace(
  modules: readonly StageModule[],
  x: number,
  z: number,
  type: ModuleType,
): boolean {
  if (modules.length >= BUILD_MAX_MODULES) return false;
  if (!inPlot(x, z)) return false;
  const sx = snapToGrid(x);
  const sz = snapToGrid(z);
  // dancefloor can stack-adjacent freely; other types block same cell
  for (const m of modules) {
    if (m.x === sx && m.z === sz) {
      if (type === 'dancefloor' && m.type === 'dancefloor') return false;
      if (type !== 'dancefloor' || m.type !== 'dancefloor') return false;
    }
  }
  return true;
}

export function placeModule(
  state: PlayerStageState,
  type: ModuleType,
  x: number,
  z: number,
  rotY = 0,
  id?: string,
): PlayerStageState | null {
  const sx = snapToGrid(x);
  const sz = snapToGrid(z);
  if (!canPlace(state.modules, sx, sz, type)) return null;
  const mod: StageModule = {
    id: id ?? `m_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
    type,
    x: sx,
    z: sz,
    rotY,
    color: type === 'lightPole' || type === 'ledWall' ? '#ff00aa' : undefined,
    lightMode: type === 'lightPole' || type === 'ledWall' ? 'beat' : undefined,
  };
  return { ...state, modules: [...state.modules, mod] };
}

export function removeModule(
  state: PlayerStageState,
  id: string,
): PlayerStageState {
  return {
    ...state,
    modules: state.modules.filter((m) => m.id !== id),
  };
}

export function rotateModule(
  state: PlayerStageState,
  id: string,
  delta = Math.PI / 2,
): PlayerStageState {
  return {
    ...state,
    modules: state.modules.map((m) =>
      m.id === id ? { ...m, rotY: m.rotY + delta } : m,
    ),
  };
}

export function updateModule(
  state: PlayerStageState,
  id: string,
  patch: Partial<Pick<StageModule, 'color' | 'lightMode' | 'rotY'>>,
): PlayerStageState {
  return {
    ...state,
    modules: state.modules.map((m) => (m.id === id ? { ...m, ...patch } : m)),
  };
}

export function nearestModule(
  modules: readonly StageModule[],
  x: number,
  z: number,
  maxDist = 3,
): StageModule | null {
  let best: StageModule | null = null;
  let bestD = maxDist * maxDist;
  for (const m of modules) {
    const dx = m.x - x;
    const dz = m.z - z;
    const d = dx * dx + dz * dz;
    if (d < bestD) {
      bestD = d;
      best = m;
    }
  }
  return best;
}
