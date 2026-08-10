import { describe, expect, it } from 'vitest';
import {
  clampToWorld,
  makeBox,
  resolveMovement,
} from './collision';
import { WORLD_BOUNDS } from './constants';

describe('collision', () => {
  it('clamps to world bounds', () => {
    const c = clampToWorld(9999, -9999, 0.5);
    expect(c.x).toBeLessThanOrEqual(WORLD_BOUNDS.maxX);
    expect(c.z).toBeGreaterThanOrEqual(WORLD_BOUNDS.minZ);
  });

  it('resolves movement against AABB obstacles', () => {
    const wall = makeBox(5, 0, 1, 5);
    const from = { x: 0, z: 0 };
    const hit = resolveMovement(from, 10, 0, 0.5, [wall]);
    expect(hit.x).toBeLessThan(wall.minX);
    const free = resolveMovement(from, 0, 3, 0.5, [wall]);
    expect(free.z).toBeCloseTo(3);
  });
});
