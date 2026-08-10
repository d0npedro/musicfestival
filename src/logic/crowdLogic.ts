/**
 * Map music intensity + weather into dance amplitude and speed multipliers.
 * Pure functions used by Crowd system and unit tests.
 */

export function danceAmplitude(intensity: number, base = 0.08): number {
  const i = clamp01(intensity);
  return base + i * 0.45;
}

export function danceSpeed(intensity: number): number {
  const i = clamp01(intensity);
  return 1.2 + i * 4.5;
}

export function wanderSpeed(intensity: number, weatherSlow: number): number {
  const i = clamp01(intensity);
  const base = 1.4 + i * 0.6;
  return base * (1 - 0.35 * clamp01(weatherSlow));
}

/**
 * Pick attraction weight toward nearest stage vs random wander.
 * High intensity pulls agents toward stages.
 */
export function stageAttraction(intensity: number): number {
  const i = clamp01(intensity);
  return 0.15 + i * 0.7;
}

export function blendIntensity(
  stageIntensity: number,
  distance: number,
  falloff = 40,
): number {
  if (falloff <= 0) return 0;
  const t = 1 - Math.min(1, distance / falloff);
  return clamp01(stageIntensity) * t * t;
}

/** Soft weather slowdown for cloudy/rain/fog. */
export function weatherSlowFactor(
  cloudiness: number,
  rain: number,
): number {
  return clamp01(cloudiness * 0.4 + rain * 0.5);
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}
