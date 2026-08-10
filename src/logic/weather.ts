import { WEATHER_TYPES, type WeatherType } from './constants';

export type WeatherState = {
  type: WeatherType;
  /** 0–1 blend into current type (1 = fully there). */
  blend: number;
  /** Seconds until next random transition attempt. */
  nextChangeIn: number;
};

export function createWeather(type: WeatherType = 'clear'): WeatherState {
  return { type, blend: 1, nextChangeIn: 45 + Math.random() * 60 };
}

export function isWeatherType(v: string): v is WeatherType {
  return (WEATHER_TYPES as readonly string[]).includes(v);
}

/**
 * Advance weather timers and optional random transitions.
 * Deterministic when rng is provided.
 */
export function advanceWeather(
  state: WeatherState,
  dtSec: number,
  rng: () => number = Math.random,
): WeatherState {
  let { type, blend, nextChangeIn } = state;
  blend = Math.min(1, blend + dtSec / 12);
  nextChangeIn -= dtSec;

  if (nextChangeIn <= 0) {
    nextChangeIn = 40 + rng() * 80;
    if (rng() < 0.55) {
      const idx = Math.floor(rng() * WEATHER_TYPES.length);
      const next = WEATHER_TYPES[idx] ?? 'clear';
      if (next !== type) {
        type = next;
        blend = 0;
      }
    }
  }

  return { type, blend, nextChangeIn };
}

/** Force a weather type (e.g. for tests / debug). */
export function setWeather(type: WeatherType): WeatherState {
  return { type, blend: 1, nextChangeIn: 60 };
}

export type WeatherVisual = {
  fogDensity: number;
  cloudiness: number;
  rain: number;
  ambientScale: number;
};

export function weatherVisual(state: WeatherState): WeatherVisual {
  const b = state.blend;
  const base: WeatherVisual = {
    fogDensity: 0.004,
    cloudiness: 0.15,
    rain: 0,
    ambientScale: 1,
  };

  const targets: Record<WeatherType, WeatherVisual> = {
    clear: { fogDensity: 0.003, cloudiness: 0.1, rain: 0, ambientScale: 1 },
    cloudy: { fogDensity: 0.008, cloudiness: 0.75, rain: 0, ambientScale: 0.75 },
    rain: { fogDensity: 0.012, cloudiness: 0.9, rain: 1, ambientScale: 0.55 },
    fog: { fogDensity: 0.035, cloudiness: 0.6, rain: 0, ambientScale: 0.65 },
  };

  const t = targets[state.type];
  return {
    fogDensity: lerp(base.fogDensity, t.fogDensity, b),
    cloudiness: lerp(base.cloudiness, t.cloudiness, b),
    rain: lerp(base.rain, t.rain, b),
    ambientScale: lerp(base.ambientScale, t.ambientScale, b),
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Crowd shelter bias 0–1 (higher in rain). */
export function shelterBias(state: WeatherState): number {
  if (state.type === 'rain') return 0.35 + 0.5 * state.blend;
  if (state.type === 'fog') return 0.15 * state.blend;
  return 0;
}
