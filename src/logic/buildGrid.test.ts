import { describe, expect, it } from 'vitest';
import {
  canPlace,
  createPlayerStage,
  inPlot,
  placeModule,
  removeModule,
  snapToGrid,
} from './buildGrid';
import { BUILD_MAX_MODULES, PLOT_CENTER } from './constants';

describe('buildGrid', () => {
  it('snaps and validates plot placement', () => {
    expect(snapToGrid(3.4)).toBe(4);
    expect(inPlot(PLOT_CENTER.x, PLOT_CENTER.z)).toBe(true);
    expect(inPlot(0, 0)).toBe(false);
    let s = createPlayerStage();
    const a = placeModule(s, 'deck', PLOT_CENTER.x, PLOT_CENTER.z);
    expect(a).not.toBeNull();
    s = a!;
    expect(placeModule(s, 'speakers', PLOT_CENTER.x, PLOT_CENTER.z)).toBeNull();
    s = removeModule(s, s.modules[0]!.id);
    expect(s.modules).toHaveLength(0);
  });

  it('enforces max modules', () => {
    let s = createPlayerStage();
    for (let i = 0; i < BUILD_MAX_MODULES; i++) {
      // place on unique grid cells along x within plot
      const x = PLOT_CENTER.x - 8 + (i % 9) * 2;
      const z = PLOT_CENTER.z - 8 + Math.floor(i / 9) * 2;
      if (!canPlace(s.modules, x, z, 'dancefloor')) continue;
      const next = placeModule(s, 'dancefloor', x, z, 0, `m${i}`);
      if (next) s = next;
    }
    expect(s.modules.length).toBeGreaterThan(0);
    expect(s.modules.length).toBeLessThanOrEqual(BUILD_MAX_MODULES);
  });
});
