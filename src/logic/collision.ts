import { PLAYER_RADIUS, WORLD_BOUNDS } from './constants';

export type AABB = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export type Vec2 = { x: number; z: number };

export function clampToWorld(x: number, z: number, radius = PLAYER_RADIUS): Vec2 {
  return {
    x: Math.min(WORLD_BOUNDS.maxX - radius, Math.max(WORLD_BOUNDS.minX + radius, x)),
    z: Math.min(WORLD_BOUNDS.maxZ - radius, Math.max(WORLD_BOUNDS.minZ + radius, z)),
  };
}

export function pointInAABB(x: number, z: number, box: AABB, expand = 0): boolean {
  return (
    x >= box.minX - expand &&
    x <= box.maxX + expand &&
    z >= box.minZ - expand &&
    z <= box.maxZ + expand
  );
}

export function circleHitsAABB(
  x: number,
  z: number,
  radius: number,
  box: AABB,
): boolean {
  const cx = Math.min(Math.max(x, box.minX), box.maxX);
  const cz = Math.min(Math.max(z, box.minZ), box.maxZ);
  const dx = x - cx;
  const dz = z - cz;
  return dx * dx + dz * dz < radius * radius;
}

/**
 * Move with simple axis-separated collision against AABBs.
 * Sweeps each axis so large steps cannot tunnel through thin obstacles.
 * Returns resolved position.
 */
export function resolveMovement(
  from: Vec2,
  dx: number,
  dz: number,
  radius: number,
  obstacles: readonly AABB[],
): Vec2 {
  let x = from.x;
  let z = from.z;

  // X axis sweep
  if (dx !== 0) {
    const targetX = x + dx;
    if (dx > 0) {
      let maxX = targetX;
      for (const box of obstacles) {
        if (z + radius > box.minZ && z - radius < box.maxZ) {
          const face = box.minX - radius;
          if (x <= face && targetX > face) maxX = Math.min(maxX, face);
        }
      }
      x = maxX;
    } else {
      let minX = targetX;
      for (const box of obstacles) {
        if (z + radius > box.minZ && z - radius < box.maxZ) {
          const face = box.maxX + radius;
          if (x >= face && targetX < face) minX = Math.max(minX, face);
        }
      }
      x = minX;
    }
    // depenetrate if already overlapping
    for (const box of obstacles) {
      if (circleHitsAABB(x, z, radius, box)) {
        if (dx > 0) x = Math.min(x, box.minX - radius);
        else x = Math.max(x, box.maxX + radius);
      }
    }
  }

  // Z axis sweep
  if (dz !== 0) {
    const targetZ = z + dz;
    if (dz > 0) {
      let maxZ = targetZ;
      for (const box of obstacles) {
        if (x + radius > box.minX && x - radius < box.maxX) {
          const face = box.minZ - radius;
          if (z <= face && targetZ > face) maxZ = Math.min(maxZ, face);
        }
      }
      z = maxZ;
    } else {
      let minZ = targetZ;
      for (const box of obstacles) {
        if (x + radius > box.minX && x - radius < box.maxX) {
          const face = box.maxZ + radius;
          if (z >= face && targetZ < face) minZ = Math.max(minZ, face);
        }
      }
      z = minZ;
    }
    for (const box of obstacles) {
      if (circleHitsAABB(x, z, radius, box)) {
        if (dz > 0) z = Math.min(z, box.minZ - radius);
        else z = Math.max(z, box.maxZ + radius);
      }
    }
  }

  return clampToWorld(x, z, radius);
}

export function makeBox(
  cx: number,
  cz: number,
  halfW: number,
  halfD: number,
): AABB {
  return {
    minX: cx - halfW,
    maxX: cx + halfW,
    minZ: cz - halfD,
    maxZ: cz + halfD,
  };
}
