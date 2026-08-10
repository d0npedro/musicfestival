import {
  GENRE_STAGES,
  HERD_ARMS_BONUS,
  HERD_PUSH_FORCE,
  HERD_PUSH_RADIUS,
  HERD_SHOUT_FORCE,
  HERD_SHOUT_RADIUS,
  MISSION_SECONDS,
  WIN_HERD_RATIO,
} from './constants';

export type HerdAgent = {
  x: number;
  z: number;
  vx: number;
  vz: number;
  /** Stubborn sheep personality 0–1 (higher = more random). */
  stubborn: number;
  /** Random wander heading. */
  wanderAngle: number;
  wanderTimer: number;
  /** Brief panic / wrong-way impulse. */
  wrongWay: number;
  /**
   * Once driven into a stage zone, stay there (dance/crowd at the show).
   * Sticky: does not unset if briefly nudged.
   */
  settled: boolean;
  /** Home stage index when settled (GENRE_STAGES). */
  homeStage: number;
};

export type GuardState = {
  x: number;
  z: number;
  /** Facing yaw (radians). */
  yaw: number;
  /** Arms wide shepherd pose. */
  armsOpen: boolean;
  /** Radio shout pulse 0–1. */
  shout: number;
};

export type MissionState = {
  timeLeft: number;
  herded: number;
  total: number;
  ratio: number;
  status: 'playing' | 'won' | 'lost';
};

export function createMission(total: number, timeLeft = MISSION_SECONDS): MissionState {
  return {
    timeLeft,
    herded: 0,
    total,
    ratio: 0,
    status: 'playing',
  };
}

export function advanceMissionTime(m: MissionState, dt: number): MissionState {
  if (m.status !== 'playing') return m;
  const timeLeft = Math.max(0, m.timeLeft - dt);
  let status: MissionState['status'] = 'playing';
  if (m.ratio >= WIN_HERD_RATIO) status = 'won';
  else if (timeLeft <= 0) status = m.ratio >= WIN_HERD_RATIO ? 'won' : 'lost';
  return { ...m, timeLeft, status };
}

export function withHerdCount(m: MissionState, herded: number): MissionState {
  const total = Math.max(1, m.total);
  const ratio = herded / total;
  let status = m.status;
  if (status === 'playing' && ratio >= WIN_HERD_RATIO) status = 'won';
  return { ...m, herded, ratio, status };
}

export function formatTimer(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${String(ss).padStart(2, '0')}`;
}

/** Stage zone center (dancefloor in front of stage). */
export function stageZoneCenter(stageIndex: number): { x: number; z: number; radius: number } {
  const st = GENRE_STAGES[stageIndex] ?? GENRE_STAGES[0]!;
  return { x: st.x, z: st.z + 8, radius: st.zoneRadius };
}

/** True if agent is inside any stage dance/herd zone. */
export function isInStageZone(x: number, z: number): boolean {
  return nearestStageIndex(x, z) >= 0;
}

/** Index of containing stage zone, or -1. */
export function nearestStageIndex(x: number, z: number): number {
  for (let i = 0; i < GENRE_STAGES.length; i++) {
    const st = GENRE_STAGES[i]!;
    const d = Math.hypot(x - st.x, z - (st.z + 8));
    if (d <= st.zoneRadius) return i;
  }
  return -1;
}

/**
 * Count ravers that count toward the goal: currently in a stage zone
 * OR already settled (sticky herding — they stay at the show).
 */
export function countHerded(
  agents: readonly { x: number; z: number; settled?: boolean }[],
): number {
  let n = 0;
  for (const a of agents) {
    if (a.settled || isInStageZone(a.x, a.z)) n++;
  }
  return n;
}

/** Clamp position into a stage zone (keep ravers on the dancefloor). */
export function clampToStageZone(
  x: number,
  z: number,
  stageIndex: number,
  margin = 0.85,
): { x: number; z: number } {
  const { x: cx, z: cz, radius } = stageZoneCenter(stageIndex);
  const r = radius * margin;
  const dx = x - cx;
  const dz = z - cz;
  const d = Math.hypot(dx, dz);
  if (d <= r || d < 1e-6) return { x, z };
  const s = r / d;
  return { x: cx + dx * s, z: cz + dz * s };
}

/**
 * Sheep force from a security guard: flee from the guard, biased
 * slightly toward the nearest stage so herding "works" when you approach
 * from the open field side (classic shepherd: drive from behind).
 */
export function shepherdForce(
  agent: { x: number; z: number },
  guard: GuardState,
): { fx: number; fz: number } {
  const dx = agent.x - guard.x;
  const dz = agent.z - guard.z;
  const dist = Math.hypot(dx, dz) || 0.0001;
  const radius = guard.armsOpen ? HERD_PUSH_RADIUS * HERD_ARMS_BONUS : HERD_PUSH_RADIUS;
  let fx = 0;
  let fz = 0;

  if (dist < radius) {
    const t = 1 - dist / radius;
    const force = HERD_PUSH_FORCE * t * t * (guard.armsOpen ? HERD_ARMS_BONUS : 1);
    fx += (dx / dist) * force;
    fz += (dz / dist) * force;

    // Soft lateral "funnel" when arms open: push sideways if nearly facing agent
    if (guard.armsOpen) {
      const sideX = -Math.sin(guard.yaw);
      const sideZ = -Math.cos(guard.yaw);
      // Prefer push roughly along guard facing (away from guard into field)
      const faceX = Math.sin(guard.yaw);
      const faceZ = Math.cos(guard.yaw);
      const along = (dx / dist) * faceX + (dz / dist) * faceZ;
      if (along > -0.2) {
        fx += faceX * force * 0.35;
        fz += faceZ * force * 0.35;
      }
      // widen with arms
      const cross = (dx / dist) * sideX + (dz / dist) * sideZ;
      fx += sideX * cross * force * 0.15;
      fz += sideZ * cross * force * 0.15;
    }
  }

  if (guard.shout > 0.05 && dist < HERD_SHOUT_RADIUS) {
    const t = 1 - dist / HERD_SHOUT_RADIUS;
    const force = HERD_SHOUT_FORCE * guard.shout * t;
    fx += (dx / dist) * force;
    fz += (dz / dist) * force;
  }

  return { fx, fz };
}

/** Gentle drift toward nearest stage (ravers vaguely "want" the music). */
export function stageDrift(x: number, z: number, strength = 1.2): { fx: number; fz: number } {
  let bestX: number = GENRE_STAGES[0]!.x;
  let bestZ: number = GENRE_STAGES[0]!.z + 8;
  let bestD = Infinity;
  for (const st of GENRE_STAGES) {
    const d = Math.hypot(x - st.x, z - (st.z + 8));
    if (d < bestD) {
      bestD = d;
      bestX = st.x;
      bestZ = st.z + 8;
    }
  }
  const dx = bestX - x;
  const dz = bestZ - z;
  const d = Math.hypot(dx, dz) || 1;
  // Weak — sheep mostly ignore good ideas
  const s = strength * Math.min(1, bestD / 80);
  return { fx: (dx / d) * s, fz: (dz / d) * s };
}

export function integrateSheep(
  agent: HerdAgent,
  guard: GuardState,
  dt: number,
  rng: () => number = Math.random,
): HerdAgent {
  let {
    x,
    z,
    vx,
    vz,
    stubborn,
    wanderAngle,
    wanderTimer,
    wrongWay,
    settled,
    homeStage,
  } = agent;

  // Sticky settle: once inside a stage zone, stay at that show
  const zoneIdx = nearestStageIndex(x, z);
  if (!settled && zoneIdx >= 0) {
    settled = true;
    homeStage = zoneIdx;
  }

  // --- Settled ravers: dance on stage, never leave the zone ---
  if (settled) {
    const home = homeStage >= 0 ? homeStage : Math.max(0, zoneIdx);
    const { x: cx, z: cz } = stageZoneCenter(home);

    wanderTimer -= dt;
    if (wanderTimer <= 0) {
      wanderTimer = 0.8 + rng() * 1.5;
      wanderAngle = rng() * Math.PI * 2;
    }

    // Mild shuffle toward zone center + tiny orbit (party, not escape)
    const toCx = cx - x;
    const toCz = cz - z;
    const distC = Math.hypot(toCx, toCz) || 1;
    const dance = 1.1 + rng() * 0.4;
    const ax =
      (toCx / distC) * 1.6 + Math.sin(wanderAngle) * dance + (rng() - 0.5) * 0.5;
    const az =
      (toCz / distC) * 1.6 + Math.cos(wanderAngle) * dance + (rng() - 0.5) * 0.5;

    // Softly ignore shepherd once settled (they're already "delivered")
    const lag = 0.55;
    vx = vx * (1 - lag) + ax * lag;
    vz = vz * (1 - lag) + az * lag;
    const sp = Math.hypot(vx, vz);
    const maxSp = 2.8;
    if (sp > maxSp) {
      vx = (vx / sp) * maxSp;
      vz = (vz / sp) * maxSp;
    }

    x += vx * dt;
    z += vz * dt;
    const clamped = clampToStageZone(x, z, home, 0.88);
    x = clamped.x;
    z = clamped.z;
    // Kill outward velocity at boundary
    const after = Math.hypot(x - cx, z - cz);
    const { radius } = stageZoneCenter(home);
    if (after > radius * 0.82) {
      vx *= 0.3;
      vz *= 0.3;
    }

    return {
      x,
      z,
      vx,
      vz,
      stubborn,
      wanderAngle,
      wanderTimer,
      wrongWay: 0,
      settled: true,
      homeStage: home,
    };
  }

  // --- Field sheep: stubborn wander + herding ---
  wanderTimer -= dt;
  if (wanderTimer <= 0) {
    wanderTimer = 0.6 + rng() * 1.8;
    wanderAngle += (rng() - 0.5) * (1.2 + stubborn * 2.5);
  }

  // Random wrong-way bolt
  wrongWay = Math.max(0, wrongWay - dt);
  if (wrongWay <= 0 && rng() < 0.015 * dt * 60 * (0.4 + stubborn)) {
    wrongWay = 0.8 + rng() * 1.4;
    wanderAngle += Math.PI * (0.6 + rng() * 0.8) * (rng() < 0.5 ? 1 : -1);
  }

  const sheepSpeed = 2.2 + stubborn * 2.8 + (wrongWay > 0 ? 2.5 : 0);
  const wx = Math.sin(wanderAngle) * sheepSpeed * (0.55 + stubborn * 0.7);
  const wz = Math.cos(wanderAngle) * sheepSpeed * (0.55 + stubborn * 0.7);

  const herd = shepherdForce({ x, z }, guard);
  const drift = stageDrift(x, z, 0.9 + (1 - stubborn) * 0.8);

  // Separation is approximated by noise when packed — pure logic stays O(1)
  const sepX = (rng() - 0.5) * stubborn * 0.8;
  const sepZ = (rng() - 0.5) * stubborn * 0.8;

  const ax = wx * 0.7 + herd.fx + drift.fx + sepX;
  const az = wz * 0.7 + herd.fz + drift.fz + sepZ;

  // Damping — stubborn sheep accelerate slowly / lag
  const lag = 0.35 + (1 - stubborn) * 0.45;
  vx = vx * (1 - lag) + ax * lag;
  vz = vz * (1 - lag) + az * lag;

  // Cap speed
  const sp = Math.hypot(vx, vz);
  const maxSp = 7 + stubborn * 3;
  if (sp > maxSp) {
    vx = (vx / sp) * maxSp;
    vz = (vz / sp) * maxSp;
  }

  x += vx * dt;
  z += vz * dt;

  // Enter zone this frame → settle immediately
  const entered = nearestStageIndex(x, z);
  if (entered >= 0) {
    settled = true;
    homeStage = entered;
    const c = clampToStageZone(x, z, entered, 0.88);
    x = c.x;
    z = c.z;
  }

  return {
    x,
    z,
    vx,
    vz,
    stubborn,
    wanderAngle,
    wanderTimer,
    wrongWay,
    settled,
    homeStage,
  };
}

export function winThreshold(): number {
  return WIN_HERD_RATIO;
}
