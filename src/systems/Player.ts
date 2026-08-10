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
import type { GuardState } from '../logic/herding';

/**
 * Overwhelmed festival security guard — black uniform, high-vis vest, radio.
 * Space = arms wide (shepherd), E / F = radio shout.
 */
export class Player {
  readonly position = new THREE.Vector3(0, 0, 35);
  yaw = Math.PI;
  armsOpen = false;
  shout = 0;
  readonly mesh: THREE.Group;
  private torso: THREE.Mesh;
  private leftArm: THREE.Mesh;
  private rightArm: THREE.Mesh;
  private vest: THREE.Mesh;
  private radio: THREE.Mesh;
  private moving = false;

  constructor() {
    this.mesh = new THREE.Group();

    const black = new THREE.MeshStandardMaterial({
      color: 0x1a1a1e,
      roughness: 0.75,
      metalness: 0.15,
    });
    const skin = new THREE.MeshStandardMaterial({ color: 0xc4a574, roughness: 0.7 });
    const hiVis = new THREE.MeshStandardMaterial({
      color: 0xffcc00,
      emissive: 0xaa7700,
      emissiveIntensity: 0.35,
      roughness: 0.55,
    });
    const plastic = new THREE.MeshStandardMaterial({
      color: 0x222228,
      roughness: 0.4,
      metalness: 0.3,
    });

    // Legs
    const legL = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.55, 3, 6), black);
    legL.position.set(-0.14, 0.45, 0);
    const legR = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.55, 3, 6), black);
    legR.position.set(0.14, 0.45, 0);

    // Boots
    const bootL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.36), black);
    bootL.position.set(-0.14, 0.08, 0.04);
    const bootR = bootL.clone();
    bootR.position.x = 0.14;

    // Torso (uniform)
    this.torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.55, 4, 8), black);
    this.torso.position.y = 1.05;
    this.torso.castShadow = true;

    // High-vis vest
    this.vest = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.55, 0.42), hiVis);
    this.vest.position.y = 1.1;

    // Reflective stripes
    const stripeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffaa,
      emissiveIntensity: 0.4,
    });
    const stripe1 = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.06, 0.44), stripeMat);
    stripe1.position.set(0, 1.22, 0);
    const stripe2 = stripe1.clone();
    stripe2.position.y = 0.98;

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 12), skin);
    head.position.y = 1.62;
    head.castShadow = true;

    // Cap
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.28, 0.14, 12),
      black,
    );
    cap.position.y = 1.78;
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, 0.22), black);
    brim.position.set(0, 1.72, 0.16);

    // Arms (shepherd pose animated)
    this.leftArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.5, 3, 6), black);
    this.leftArm.position.set(-0.42, 1.15, 0);
    this.rightArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.5, 3, 6), black);
    this.rightArm.position.set(0.42, 1.15, 0);

    // Radio on shoulder
    this.radio = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.1), plastic);
    this.radio.position.set(0.38, 1.4, 0.05);
    const antenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.28, 6),
      new THREE.MeshStandardMaterial({ color: 0x888899, metalness: 0.7 }),
    );
    antenna.position.set(0.38, 1.58, 0.05);

    // Radio LED
    const led = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 6, 6),
      new THREE.MeshStandardMaterial({
        color: 0x22ff66,
        emissive: 0x22ff66,
        emissiveIntensity: 0.9,
      }),
    );
    led.position.set(0.38, 1.48, 0.11);

    this.mesh.add(
      legL,
      legR,
      bootL,
      bootR,
      this.torso,
      this.vest,
      stripe1,
      stripe2,
      head,
      cap,
      brim,
      this.leftArm,
      this.rightArm,
      this.radio,
      antenna,
      led,
    );
  }

  setPose(x: number, z: number, yaw: number): void {
    this.position.set(x, 0, z);
    this.yaw = yaw;
    this.syncMesh();
  }

  getGuardState(): GuardState {
    return {
      x: this.position.x,
      z: this.position.z,
      yaw: this.yaw,
      armsOpen: this.armsOpen,
      shout: this.shout,
    };
  }

  update(dt: number, input: Input, cameraYaw: number, obstacles: readonly AABB[]): void {
    let mx = 0;
    let mz = 0;
    if (input.isDown('KeyW') || input.isDown('ArrowUp')) mz -= 1;
    if (input.isDown('KeyS') || input.isDown('ArrowDown')) mz += 1;
    if (input.isDown('KeyA') || input.isDown('ArrowLeft')) mx -= 1;
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) mx += 1;

    this.armsOpen = input.isDown('Space');
    // Shout decays; E or F triggers
    if (input.pressed('KeyE') || input.pressed('KeyF') || input.pressed('KeyR')) {
      this.shout = 1;
    } else {
      this.shout = Math.max(0, this.shout - dt * 1.8);
    }

    const len = Math.hypot(mx, mz);
    this.moving = len > 0;
    if (len > 0) {
      mx /= len;
      mz /= len;
      // Arms open = slightly slower (full body block)
      const sprint = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
      let speed = sprint ? PLAYER_SPRINT_SPEED : PLAYER_WALK_SPEED;
      if (this.armsOpen) speed *= 0.82;
      const sin = Math.sin(cameraYaw);
      const cos = Math.cos(cameraYaw);
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

    this.animate(dt);
    this.syncMesh();
  }

  private animate(_dt: number): void {
    const t = performance.now() * 0.001;
    const bob = this.moving ? Math.sin(t * 12) * 0.05 : 0;
    this.torso.position.y = 1.05 + bob;
    this.vest.position.y = 1.1 + bob;

    if (this.armsOpen) {
      // Wide shepherd arms
      this.leftArm.position.set(-0.75, 1.2 + bob, 0.15);
      this.leftArm.rotation.set(0.2, 0, 1.15);
      this.rightArm.position.set(0.75, 1.2 + bob, 0.15);
      this.rightArm.rotation.set(0.2, 0, -1.15);
    } else {
      const swing = this.moving ? Math.sin(t * 12) * 0.45 : 0;
      this.leftArm.position.set(-0.42, 1.15 + bob, 0);
      this.leftArm.rotation.set(swing, 0, 0.25);
      this.rightArm.position.set(0.42, 1.15 + bob, 0);
      this.rightArm.rotation.set(-swing, 0, -0.25);
    }

    // Radio buzz when shouting
    if (this.shout > 0.2) {
      this.radio.scale.setScalar(1 + Math.sin(t * 40) * 0.08 * this.shout);
    } else {
      this.radio.scale.setScalar(1);
    }
  }

  private syncMesh(): void {
    this.mesh.position.set(this.position.x, this.position.y, this.position.z);
    this.mesh.rotation.y = this.yaw;
  }

  get headHeight(): number {
    return PLAYER_HEIGHT;
  }
}
