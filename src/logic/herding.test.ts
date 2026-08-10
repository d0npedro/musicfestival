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
      settled: false,
      homeStage: -1,
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

  it('keeps settled ravers inside their stage zone', () => {
    const st = GENRE_STAGES[0]!;
    let agent: HerdAgent = {
      x: st.x,
      z: st.z + 8,
      vx: 20,
      vz: 20,
      stubborn: 0.9,
      wanderAngle: 0,
      wanderTimer: 0,
      wrongWay: 1,
      settled: true,
      homeStage: 0,
    };
    const guard: GuardState = {
      x: st.x,
      z: st.z + 8,
      yaw: 0,
      armsOpen: true,
      shout: 1,
    };
    for (let i = 0; i < 40; i++) {
      agent = integrateSheep(agent, guard, 0.05, () => 0.9);
    }
    expect(agent.settled).toBe(true);
    expect(isInStageZone(agent.x, agent.z)).toBe(true);
    expect(countHerded([agent])).toBe(1);
  });

  it('settles when entering a stage zone', () => {
    const st = GENRE_STAGES[1]!;
    const agent: HerdAgent = {
      x: st.x,
      z: st.z + 8,
      vx: 0,
      vz: 0,
      stubborn: 0.2,
      wanderAngle: 0,
      wanderTimer: 1,
      wrongWay: 0,
      settled: false,
      homeStage: -1,
    };
    const guard: GuardState = {
      x: 0,
      z: 0,
      yaw: 0,
      armsOpen: false,
      shout: 0,
    };
    const next = integrateSheep(agent, guard, 0.016, () => 0.1);
    expect(next.settled).toBe(true);
    expect(next.homeStage).toBe(1);
  });
});
