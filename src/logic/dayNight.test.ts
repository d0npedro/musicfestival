import { describe, expect, it } from 'vitest';
import {
  advanceDayPhase,
  dayPeriod,
  nightBoost,
  sunElevationFactor,
} from './dayNight';

describe('dayNight', () => {
  it('advances phase with wrap', () => {
    expect(advanceDayPhase(0.9, 100, 1000)).toBeCloseTo(1.0 % 1);
    const mid = advanceDayPhase(0.5, 50, 100);
    expect(mid).toBeCloseTo(0);
    const night = advanceDayPhase(0, 0, 600);
    expect(night).toBe(0);
  });

  it('classifies periods and sun factors', () => {
    expect(dayPeriod(0.5)).toBe('day');
    expect(dayPeriod(0.1)).toBe('night');
    expect(sunElevationFactor(0.5)).toBeGreaterThan(0.9);
    expect(sunElevationFactor(0)).toBeLessThan(0.1);
    expect(nightBoost(0)).toBeGreaterThan(nightBoost(0.5));
  });
});
