import { describe, expect, it } from 'vitest';
import {
  blendIntensity,
  danceAmplitude,
  danceSpeed,
  stageAttraction,
  wanderSpeed,
  weatherSlowFactor,
} from './crowdLogic';

describe('crowdLogic', () => {
  it('maps intensity to dance and attraction', () => {
    expect(danceAmplitude(0)).toBeLessThan(danceAmplitude(1));
    expect(danceSpeed(1)).toBeGreaterThan(danceSpeed(0));
    expect(stageAttraction(1)).toBeGreaterThan(stageAttraction(0));
    expect(blendIntensity(1, 0)).toBe(1);
    expect(blendIntensity(1, 100, 40)).toBe(0);
  });

  it('slows wander under bad weather', () => {
    const clear = wanderSpeed(0.5, 0);
    const storm = wanderSpeed(0.5, weatherSlowFactor(0.9, 1));
    expect(storm).toBeLessThan(clear);
  });
});
