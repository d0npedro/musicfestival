import { describe, expect, it } from 'vitest';
import {
  advanceMissionTime,
  countHerded,
  createMission,
  formatTimer,
  integrateSheep,
  isInStageZone,
  shepherdForce,
  withHerdCount,
  type GuardState,
  type HerdAgent,
} from './herding';
import { GENRE_STAGES, WIN_HERD_RATIO } from './constants';

describe('herding mission', () => {
  it('formats timer and advances to loss when time runs out under threshold', () => {
    expect(formatTimer(125)).toBe('2:05');
    let m = createMission(100, 1);
    m = withHerdCount(m, 10);
    m = advanceMissionTime(m, 2);
    expect(m.timeLeft).toBe(0);
    expect(m.status).toBe('lost');
  });

  it('wins when herded ratio meets threshold', () => {
    let m = createMission(100, 60);
    m = withHerdCount(m, Math.ceil(100 * WIN_HERD_RATIO));
    expect(m.status).toBe('won');
    expect(m.ratio).toBeGreaterThanOrEqual(WIN_HERD_RATIO);
  });
});

describe('stage zones', () => {
  it('detects agents in stage zones', () => {
    const st = GENRE_STAGES[0]!;
    expect(isInStageZone(st.x, st.z + 8)).toBe(true);
    expect(isInStageZone(0, 0)).toBe(false);
    expect(countHerded([{ x: st.x, z: st.z + 8 }, { x: 0, z: 0 }])).toBe(1);
  });
});

describe('shepherd force', () => {
  it('pushes agents away from the guard, stronger with arms open', () => {
    const guard: GuardState = {
      x: 0,
      z: 0,
      yaw: 0,
      armsOpen: false,
      shout: 0,
    };
    const closed = shepherdForce({ x: 0, z: 4 }, guard);
    const open = shepherdForce({ x: 0, z: 4 }, { ...guard, armsOpen: true });
    // Agent is in +Z; push should be further +Z (away)
    expect(closed.fz).toBeGreaterThan(0);
    expect(Math.hypot(open.fx, open.fz)).toBeGreaterThan(Math.hypot(closed.fx, closed.fz));
  });

  it('integrates sheep motion without NaNs', () => {
    const agent: HerdAgent = {
      x: 10,
      z: 10,
      vx: 0,
      vz: 0,
      stubborn: 0.5,
      wanderAngle: 0.2,
      wanderTimer: 0.1,
      wrongWay: 0,
    };
    const guard: GuardState = {
      x: 8,
      z: 10,
      yaw: Math.PI / 2,
      armsOpen: true,
      shout: 1,
    };
    const next = integrateSheep(agent, guard, 0.05, () => 0.3);
    expect(Number.isFinite(next.x)).toBe(true);
    expect(Number.isFinite(next.z)).toBe(true);
  });
});
