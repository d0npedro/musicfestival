import * as THREE from 'three';
import type { Player } from './Player';

export class CameraFollow {
  yaw = 0.4;
  pitch = 0.35;
  distance = 7;
  private readonly offset = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private readonly spherical = new THREE.Spherical();

  constructor(readonly camera: THREE.PerspectiveCamera) {
    this.camera.near = 0.1;
    this.camera.far = 400;
    this.camera.fov = 60;
  }

  applyLook(dx: number, dy: number): void {
    this.yaw -= dx * 0.005;
    this.pitch += dy * 0.004;
    this.pitch = Math.max(0.12, Math.min(1.2, this.pitch));
  }

  update(player: Player): void {
    this.spherical.set(this.distance, this.pitch, this.yaw);
    this.offset.setFromSpherical(this.spherical);
    this.target.set(player.position.x, player.headHeight * 0.85, player.position.z);
    const desired = this.target.clone().add(this.offset);
    this.camera.position.lerp(desired, 0.18);
    this.camera.lookAt(this.target);
  }
}
