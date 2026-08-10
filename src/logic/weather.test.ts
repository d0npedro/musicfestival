import { describe, expect, it } from 'vitest';
import {
  advanceWeather,
  createWeather,
  setWeather,
  shelterBias,
  weatherVisual,
} from './weather';

describe('weather', () => {
  it('transitions types with deterministic rng', () => {
    let w = createWeather('clear');
    w = { ...w, nextChangeIn: 0.01, blend: 1 };
    // rng: first for nextChangeIn span unused path — advanceWeather uses rng for nextChangeIn and chance and index
    let calls = 0;
    const rng = () => {
      // sequence: nextChangeIn random, chance (<0.55 => change), index for type
      const seq = [0.5, 0.1, 0.75]; // change to fog (index 3 if length 4: 0.75*4=3)
      const v = seq[calls] ?? 0.5;
      calls++;
      return v;
    };
    w = advanceWeather(w, 1, rng);
    expect(w.type).toBe('fog');
    expect(w.blend).toBe(0);
  });

  it('produces visual params and shelter bias', () => {
    const rain = setWeather('rain');
    const vis = weatherVisual(rain);
    expect(vis.rain).toBeGreaterThan(0.5);
    expect(shelterBias(rain)).toBeGreaterThan(0.3);
    expect(shelterBias(setWeather('clear'))).toBe(0);
  });
});
