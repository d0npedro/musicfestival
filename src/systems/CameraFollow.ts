import * as THREE from 'three';
import type { Player } from './Player';

/** Slightly low cinematic angle — dynamic herding action shot. */
export class CameraFollow {
  yaw = 0.15;
  pitch = 0.48;
  distance = 9;
  private readonly offset = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private readonly spherical = new THREE.Spherical();

  constructor(readonly camera: THREE.PerspectiveCamera) {
    this.camera.near = 0.1;
    this.camera.far = 400;
    this.camera.fov = 58;
  }

  applyLook(dx: number, dy: number): void {
    this.yaw -= dx * 0.005;
    // Invert vertical look: mouse up = look up / pitch down in spherical terms
    this.pitch -= dy * 0.004;
    // Prefer slightly low angle (higher pitch = more top-down; keep mid-low)
    this.pitch = Math.max(0.28, Math.min(1.05, this.pitch));
  }

  update(player: Player): void {
    this.spherical.set(this.distance, this.pitch, this.yaw);
    this.offset.setFromSpherical(this.spherical);
    // Look at chest — low angle drama
    this.target.set(player.position.x, player.headHeight * 0.55, player.position.z);
    const desired = this.target.clone().add(this.offset);
    // Bias camera a bit lower for cinematic
    desired.y = Math.max(1.2, desired.y * 0.92);
    this.camera.position.lerp(desired, 0.16);
    this.camera.lookAt(this.target.x, this.target.y + 0.35, this.target.z);
  }
}
