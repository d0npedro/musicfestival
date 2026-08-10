import * as THREE from 'three';
import {
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  PLAYER_SPRINT_SPEED,
  PLAYER_WALK_SPEED,
} from '../logic/constants';
import type { AABB } from '../logic/collision';
import { resolveMovement } from '../logic/collision';
import type { Input } from './Input';

export class Player {
  readonly position = new THREE.Vector3(0, 0, 8);
  yaw = 0;
  readonly mesh: THREE.Group;
  private body: THREE.Mesh;
  private head: THREE.Mesh;

  constructor() {
    this.mesh = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x2bfff0,
      emissive: 0x113344,
      roughness: 0.45,
      metalness: 0.2,
    });
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xffe0cc,
      roughness: 0.6,
    });
    this.body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.7, 4, 8), bodyMat);
    this.body.position.y = 0.9;
    this.body.castShadow = true;
    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), headMat);
    this.head.position.y = 1.55;
    this.head.castShadow = true;
    // visor
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.1, 0.15),
      new THREE.MeshStandardMaterial({ color: 0xff2bd6, emissive: 0xff2bd6, emissiveIntensity: 0.6 }),
    );
    visor.position.set(0, 1.55, 0.22);
    this.mesh.add(this.body, this.head, visor);
  }

  setPose(x: number, z: number, yaw: number): void {
    this.position.set(x, 0, z);
    this.yaw = yaw;
    this.syncMesh();
  }

  update(dt: number, input: Input, cameraYaw: number, obstacles: readonly AABB[]): void {
    let mx = 0;
    let mz = 0;
    if (input.isDown('KeyW') || input.isDown('ArrowUp')) mz -= 1;
    if (input.isDown('KeyS') || input.isDown('ArrowDown')) mz += 1;
    if (input.isDown('KeyA') || input.isDown('ArrowLeft')) mx -= 1;
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) mx += 1;

    const len = Math.hypot(mx, mz);
    if (len > 0) {
      mx /= len;
      mz /= len;
      const speed = input.isDown('ShiftLeft') || input.isDown('ShiftRight')
        ? PLAYER_SPRINT_SPEED
        : PLAYER_WALK_SPEED;
      const sin = Math.sin(cameraYaw);
      const cos = Math.cos(cameraYaw);
      // camera-relative: forward is -Z in camera yaw space
      const dx = (mx * cos + mz * sin) * speed * dt;
      const dz = (-mx * sin + mz * cos) * speed * dt;
      const next = resolveMovement(
        { x: this.position.x, z: this.position.z },
        dx,
        dz,
        PLAYER_RADIUS,
        obstacles,
      );
      this.position.x = next.x;
      this.position.z = next.z;
      this.yaw = Math.atan2(dx, dz);
    }

    // subtle bob
    const bob = len > 0 ? Math.sin(performance.now() * 0.012) * 0.04 : 0;
    this.body.position.y = 0.9 + bob;
    this.syncMesh();
  }

  private syncMesh(): void {
    this.mesh.position.set(this.position.x, this.position.y, this.position.z);
    this.mesh.rotation.y = this.yaw;
  }

  get headHeight(): number {
    return PLAYER_HEIGHT;
  }
}
