import { DAY_LENGTH_SEC } from './constants';

/** Phase in [0, 1): 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset. */
export function advanceDayPhase(phase: number, dtSec: number, dayLength = DAY_LENGTH_SEC): number {
  if (!Number.isFinite(phase) || !Number.isFinite(dtSec)) return 0;
  const len = dayLength > 0 ? dayLength : DAY_LENGTH_SEC;
  let next = phase + dtSec / len;
  next = next % 1;
  if (next < 0) next += 1;
  return next;
}

export type DayPeriod = 'night' | 'dawn' | 'day' | 'dusk';

export function dayPeriod(phase: number): DayPeriod {
  const p = ((phase % 1) + 1) % 1;
  if (p < 0.2 || p >= 0.85) return 'night';
  if (p < 0.3) return 'dawn';
  if (p < 0.7) return 'day';
  return 'dusk';
}

/** 0 = full night darkness, 1 = full daylight. */
export function sunElevationFactor(phase: number): number {
  const p = ((phase % 1) + 1) % 1;
  // Smooth sun arc peaking at noon (0.5)
  const angle = (p - 0.25) * Math.PI * 2;
  const elev = Math.sin(angle);
  return Math.max(0, elev);
}

/** Night intensity boost for music/lights (0–1). */
export function nightBoost(phase: number): number {
  return 1 - sunElevationFactor(phase);
}

export function sunDirection(phase: number): { x: number; y: number; z: number } {
  const p = ((phase % 1) + 1) % 1;
  const angle = (p - 0.25) * Math.PI * 2;
  return {
    x: Math.cos(angle),
    y: Math.max(0.05, Math.sin(angle)),
    z: Math.sin(angle) * 0.35,
  };
}
