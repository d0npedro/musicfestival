import * as THREE from 'three';

type Burst = {
  points: THREE.Points;
  life: number;
  maxLife: number;
  velocities: Float32Array;
};

/**
 * Short-lived visual effects: confetti, strobe, laser sweep.
 */
export class FxSystem {
  private root = new THREE.Group();
  private bursts: Burst[] = [];
  private lasers: { mesh: THREE.Mesh; life: number }[] = [];
  private strobe: THREE.PointLight;
  private strobeLife = 0;

  constructor(scene: THREE.Scene) {
    scene.add(this.root);
    this.strobe = new THREE.PointLight(0xffffff, 0, 40, 2);
    this.root.add(this.strobe);
  }

  triggerAt(x: number, y: number, z: number, kind: 'confetti' | 'laser' | 'strobe' = 'confetti'): void {
    if (kind === 'strobe' || kind === 'confetti') {
      this.spawnConfetti(x, y, z);
    }
    if (kind === 'strobe') {
      this.strobe.position.set(x, y + 3, z);
      this.strobe.intensity = 8;
      this.strobeLife = 0.25;
    }
    if (kind === 'laser') {
      this.spawnLaser(x, y, z);
    }
  }

  private spawnConfetti(x: number, y: number, z: number): void {
    const count = 120;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = x + (Math.random() - 0.5) * 2;
      positions[i * 3 + 1] = y + Math.random() * 2;
      positions[i * 3 + 2] = z + (Math.random() - 0.5) * 2;
      velocities[i * 3] = (Math.random() - 0.5) * 8;
      velocities[i * 3 + 1] = 4 + Math.random() * 8;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 8;
      const c = new THREE.Color().setHSL(Math.random(), 0.9, 0.55);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.25,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    });
    const points = new THREE.Points(geo, mat);
    this.root.add(points);
    this.bursts.push({ points, life: 0, maxLife: 1.8, velocities });
  }

  private spawnLaser(x: number, y: number, z: number): void {
    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 30, 4),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(i / 6, 1, 0.55),
          transparent: true,
          opacity: 0.75,
        }),
      );
      mesh.position.set(x, y + 5, z);
      mesh.rotation.z = (i / 6) * Math.PI;
      mesh.rotation.x = Math.random() * 0.5;
      this.root.add(mesh);
      this.lasers.push({ mesh, life: 0.8 });
    }
  }

  update(dt: number): void {
    if (this.strobeLife > 0) {
      this.strobeLife -= dt;
      this.strobe.intensity = Math.max(0, this.strobeLife * 30);
    }

    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i]!;
      b.life += dt;
      const pos = b.points.geometry.attributes.position as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      for (let j = 0; j < arr.length / 3; j++) {
        arr[j * 3]! += b.velocities[j * 3]! * dt;
        arr[j * 3 + 1]! += b.velocities[j * 3 + 1]! * dt;
        arr[j * 3 + 2]! += b.velocities[j * 3 + 2]! * dt;
        b.velocities[j * 3 + 1]! -= 12 * dt;
      }
      pos.needsUpdate = true;
      (b.points.material as THREE.PointsMaterial).opacity = 1 - b.life / b.maxLife;
      if (b.life >= b.maxLife) {
        this.root.remove(b.points);
        b.points.geometry.dispose();
        (b.points.material as THREE.Material).dispose();
        this.bursts.splice(i, 1);
      }
    }

    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const L = this.lasers[i]!;
      L.life -= dt;
      L.mesh.rotation.y += dt * 3;
      (L.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, L.life);
      if (L.life <= 0) {
        this.root.remove(L.mesh);
        L.mesh.geometry.dispose();
        (L.mesh.material as THREE.Material).dispose();
        this.lasers.splice(i, 1);
      }
    }
  }
}
