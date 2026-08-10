import { GENRE_STAGES, type GenreStageId } from './constants';
import { nightBoost } from './dayNight';
import { sequencerIntensity, type SequencerState } from './sequencer';

export type StageGains = Record<GenreStageId, number>;

/**
 * Compute per-stage gains from player position (proximity attenuation).
 * Nearest stages get higher gain; far stages near silence.
 */
export function computeStageGains(
  playerX: number,
  playerZ: number,
  maxDist = 90,
  refDist = 18,
): StageGains {
  const gains = {} as StageGains;
  for (const s of GENRE_STAGES) {
    const dx = s.x - playerX;
    const dz = s.z - playerZ;
    const d = Math.hypot(dx, dz);
    // Inverse-distance style with soft knee
    let g = 0;
    if (d < maxDist) {
      g = refDist / (refDist + d);
      g = Math.pow(g, 1.2);
      if (d > maxDist * 0.7) {
        g *= 1 - (d - maxDist * 0.7) / (maxDist * 0.3);
      }
    }
    gains[s.id] = clamp01(g);
  }
  return gains;
}

/** Base stage intensity from gain + night boost. */
export function stageIntensity(
  gain: number,
  dayPhase: number,
  baseEnergy = 0.75,
): number {
  const night = nightBoost(dayPhase);
  return clamp01(baseEnergy * clamp01(gain) * (0.75 + 0.35 * night));
}

export function playerStageGain(
  playerX: number,
  playerZ: number,
  plotX: number,
  plotZ: number,
  refDist = 14,
): number {
  const d = Math.hypot(playerX - plotX, playerZ - plotZ);
  return clamp01(refDist / (refDist + d));
}

export function combinedLocalIntensity(
  gains: StageGains,
  dayPhase: number,
  playerSeq: SequencerState,
  playerGain: number,
): number {
  let maxStage = 0;
  for (const s of GENRE_STAGES) {
    maxStage = Math.max(maxStage, stageIntensity(gains[s.id], dayPhase));
  }
  const playerI = sequencerIntensity(playerSeq) * playerGain;
  return clamp01(Math.max(maxStage, playerI));
}

export function nearestStageName(
  playerX: number,
  playerZ: number,
): { id: GenreStageId | 'plaza' | 'plot'; name: string; dist: number } {
  let best = {
    id: 'plaza' as GenreStageId | 'plaza' | 'plot',
    name: 'Plaza',
    dist: Math.hypot(playerX, playerZ),
  };
  if (best.dist < 12) {
    return best;
  }
  for (const s of GENRE_STAGES) {
    const d = Math.hypot(s.x - playerX, s.z - playerZ);
    if (d < best.dist) {
      best = { id: s.id, name: s.name, dist: d };
    }
  }
  // Player plot region
  const plotD = Math.hypot(playerX - 18, playerZ - 18);
  if (plotD < 14 && plotD < best.dist) {
    return { id: 'plot', name: 'Your Stage', dist: plotD };
  }
  return best;
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}
