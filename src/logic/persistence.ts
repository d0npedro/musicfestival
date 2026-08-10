import {
  GENRE_STAGES,
  SAVE_KEY,
  SAVE_VERSION,
  WEATHER_TYPES,
  type WeatherType,
} from './constants';
import type { PlayerStageState } from './buildGrid';
import { createPlayerStage, isModuleType } from './buildGrid';
import type { SequencerState } from './sequencer';
import { clampTempo, createEmptySequencer } from './sequencer';
import { SEQUENCER_STEPS, SEQUENCER_TRACKS } from './constants';
import { isWeatherType } from './weather';

export type SaveGame = {
  version: number;
  player: { x: number; y: number; z: number; yaw: number };
  dayPhase: number;
  weather: { type: WeatherType; blend: number; nextChangeIn: number };
  playerStage: PlayerStageState;
  visitedStages: string[];
};

export function defaultSave(): SaveGame {
  return {
    version: SAVE_VERSION,
    player: { x: 0, y: 0, z: 8, yaw: 0 },
    dayPhase: 0.35,
    weather: { type: 'clear', blend: 1, nextChangeIn: 50 },
    playerStage: createPlayerStage(),
    visitedStages: [],
  };
}

export function serializeSave(save: SaveGame): string {
  return JSON.stringify(save);
}

export function parseSave(raw: string): SaveGame | null {
  try {
    const data = JSON.parse(raw) as unknown;
    return normalizeSave(data);
  } catch {
    return null;
  }
}

export function normalizeSave(data: unknown): SaveGame | null {
  if (!data || typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;
  const base = defaultSave();

  const version = typeof o.version === 'number' ? o.version : SAVE_VERSION;
  if (version > SAVE_VERSION) return null;

  const playerRaw = o.player as Record<string, unknown> | undefined;
  const player = {
    x: num(playerRaw?.x, base.player.x),
    y: num(playerRaw?.y, base.player.y),
    z: num(playerRaw?.z, base.player.z),
    yaw: num(playerRaw?.yaw, base.player.yaw),
  };

  let dayPhase = num(o.dayPhase, base.dayPhase);
  dayPhase = ((dayPhase % 1) + 1) % 1;

  const wRaw = o.weather as Record<string, unknown> | undefined;
  let wType: WeatherType = 'clear';
  if (typeof wRaw?.type === 'string' && isWeatherType(wRaw.type)) {
    wType = wRaw.type;
  }
  const weather = {
    type: wType,
    blend: clamp01(num(wRaw?.blend, 1)),
    nextChangeIn: Math.max(0, num(wRaw?.nextChangeIn, 50)),
  };

  const playerStage = normalizePlayerStage(o.playerStage) ?? createPlayerStage();

  const visitedStages: string[] = [];
  if (Array.isArray(o.visitedStages)) {
    const valid = new Set(GENRE_STAGES.map((s) => s.id));
    for (const id of o.visitedStages) {
      if (typeof id === 'string' && valid.has(id as never) && !visitedStages.includes(id)) {
        visitedStages.push(id);
      }
    }
  }

  // Ensure weather type is one of known
  if (!(WEATHER_TYPES as readonly string[]).includes(weather.type)) {
    weather.type = 'clear';
  }

  return {
    version: SAVE_VERSION,
    player,
    dayPhase,
    weather,
    playerStage,
    visitedStages,
  };
}

function normalizePlayerStage(raw: unknown): PlayerStageState | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const modules: PlayerStageState['modules'] = [];
  if (Array.isArray(o.modules)) {
    for (const m of o.modules) {
      if (!m || typeof m !== 'object') continue;
      const mr = m as Record<string, unknown>;
      if (typeof mr.type !== 'string' || !isModuleType(mr.type)) continue;
      if (typeof mr.id !== 'string') continue;
      modules.push({
        id: mr.id,
        type: mr.type,
        x: num(mr.x, 0),
        z: num(mr.z, 0),
        rotY: num(mr.rotY, 0),
        color: typeof mr.color === 'string' ? mr.color : undefined,
        lightMode:
          mr.lightMode === 'static' ||
          mr.lightMode === 'pulse' ||
          mr.lightMode === 'beat'
            ? mr.lightMode
            : undefined,
      });
    }
  }
  const sequencer = normalizeSequencer(o.sequencer) ?? createEmptySequencer();
  return { modules, sequencer };
}

function normalizeSequencer(raw: unknown): SequencerState | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const tempo = clampTempo(num(o.tempo, 128));
  const playing = Boolean(o.playing);
  const tracks: boolean[][] = [];
  if (Array.isArray(o.tracks)) {
    for (let t = 0; t < SEQUENCER_TRACKS; t++) {
      const row = o.tracks[t];
      const cells: boolean[] = [];
      for (let s = 0; s < SEQUENCER_STEPS; s++) {
        cells.push(Array.isArray(row) ? Boolean(row[s]) : false);
      }
      tracks.push(cells);
    }
  }
  while (tracks.length < SEQUENCER_TRACKS) {
    tracks.push(Array.from({ length: SEQUENCER_STEPS }, () => false));
  }
  return { tempo, playing, tracks };
}

export function loadFromStorage(
  storage: Storage = localStorage,
  key = SAVE_KEY,
): SaveGame | null {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    return parseSave(raw);
  } catch {
    return null;
  }
}

export function saveToStorage(
  save: SaveGame,
  storage: Storage = localStorage,
  key = SAVE_KEY,
): boolean {
  try {
    storage.setItem(key, serializeSave(save));
    return true;
  } catch {
    return false;
  }
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
