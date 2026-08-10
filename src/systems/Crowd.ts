import * as THREE from 'three';
import { CROWD_COUNT, GENRE_STAGES, WORLD_HALF } from '../logic/constants';
import {
  clampToStageZone,
  countHerded,
  integrateSheep,
  type GuardState,
  type HerdAgent,
} from '../logic/herding';

/**
 * Hundreds of slightly drunk ravers that behave like stubborn sheep.
 * Glow-stick colors, flags, random bolting — herded by the guard.
 */
export class Crowd {
  private mesh: THREE.InstancedMesh;
  private propMesh: THREE.InstancedMesh;
  private agents: HerdAgent[] = [];
  private hues: number[] = [];
  private dummy = new THREE.Object3D();
  private propDummy = new THREE.Object3D();
  private colors: THREE.InstancedBufferAttribute;
  private propColors: THREE.InstancedBufferAttribute;

  constructor(scene: THREE.Scene) {
    const geo = new THREE.CapsuleGeometry(0.28, 0.55, 3, 6);
    const mat = new THREE.MeshStandardMaterial({
      roughness: 0.65,
      metalness: 0.08,
      vertexColors: true,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, CROWD_COUNT);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // Glow sticks / flags as thin boxes above some agents
    const propGeo = new THREE.BoxGeometry(0.08, 0.7, 0.08);
    const propMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      emissive: 0xffffff,
      emissiveIntensity: 0.5,
      roughness: 0.4,
    });
    this.propMesh = new THREE.InstancedMesh(propGeo, propMat, CROWD_COUNT);
    this.propMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const colorArray = new Float32Array(CROWD_COUNT * 3);
    this.colors = new THREE.InstancedBufferAttribute(colorArray, 3);
    this.mesh.instanceColor = this.colors;

    const propColorArray = new Float32Array(CROWD_COUNT * 3);
    this.propColors = new THREE.InstancedBufferAttribute(propColorArray, 3);
    this.propMesh.instanceColor = this.propColors;

    this.scatterField();
    scene.add(this.mesh);
    scene.add(this.propMesh);
  }

  /** Scatter ravers across dusty field (south of stages) — chaos at start. */
  scatterField(): void {
    this.agents = [];
    this.hues = [];
    for (let i = 0; i < CROWD_COUNT; i++) {
      // Mostly open field between player spawn and stages
      const x = (Math.random() - 0.5) * 100;
      const z = 10 + Math.random() * 70;
      // sprinkle some near sides already lost
      const scatterX = Math.random() < 0.2 ? (Math.random() < 0.5 ? -1 : 1) * (40 + Math.random() * 50) : x;
      const scatterZ = Math.random() < 0.15 ? -20 + Math.random() * 40 : z;

      const agent: HerdAgent = {
        x: scatterX,
        z: scatterZ,
        vx: 0,
        vz: 0,
        stubborn: 0.25 + Math.random() * 0.75,
        wanderAngle: Math.random() * Math.PI * 2,
        wanderTimer: Math.random() * 2,
        wrongWay: 0,
        settled: false,
        homeStage: -1,
      };
      this.agents.push(agent);
      const hue = Math.random();
      this.hues.push(hue);
      const c = new THREE.Color().setHSL(hue, 0.75, 0.5);
      this.colors.setXYZ(i, c.r, c.g, c.b);
      const glow = new THREE.Color().setHSL((hue + 0.15) % 1, 1, 0.55);
      this.propColors.setXYZ(i, glow.r, glow.g, glow.b);
      this.writeInstance(i, agent, 0);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.propMesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    if (this.propMesh.instanceColor) this.propMesh.instanceColor.needsUpdate = true;
  }

  getAgents(): readonly HerdAgent[] {
    return this.agents;
  }

  herdedCount(): number {
    return countHerded(this.agents);
  }

  update(dt: number, guard: GuardState): void {
    const time = performance.now() * 0.001;
    const bound = WORLD_HALF - 4;

    // Soft flock separation (spatial hash lite: only nearby samples)
    for (let i = 0; i < this.agents.length; i++) {
      let a = this.agents[i]!;
      a = integrateSheep(a, guard, dt);

      // Keep out of solid stage platforms roughly (field agents only)
      if (!a.settled) {
        for (const st of GENRE_STAGES) {
          const dx = a.x - st.x;
          const dz = a.z - st.z;
          if (Math.abs(dx) < 8 && Math.abs(dz) < 5 && a.z < st.z + 2) {
            a.z = st.z + 6;
          }
        }
      }

      a.x = Math.max(-bound, Math.min(bound, a.x));
      a.z = Math.max(-bound, Math.min(bound, a.z));
      this.agents[i] = a;
    }

    // Pairwise separation for nearby agents (throttled subset)
    const step = 3;
    for (let i = 0; i < this.agents.length; i += step) {
      const a = this.agents[i]!;
      for (let j = i + step; j < Math.min(this.agents.length, i + 24); j += step) {
        const b = this.agents[j]!;
        const dx = a.x - b.x;
        const dz = a.z - b.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 1.2 && d2 > 0.0001) {
          const d = Math.sqrt(d2);
          const push = (0.35 * dt) / d;
          a.x += (dx / d) * push;
          a.z += (dz / d) * push;
          b.x -= (dx / d) * push;
          b.z -= (dz / d) * push;
        }
      }
    }

    // Re-clamp settled ravers after separation so they never leave stages
    for (let i = 0; i < this.agents.length; i++) {
      const a = this.agents[i]!;
      if (a.settled && a.homeStage >= 0) {
        const c = clampToStageZone(a.x, a.z, a.homeStage, 0.88);
        a.x = c.x;
        a.z = c.z;
      }
      this.writeInstance(i, a, time);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
    this.propMesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  private writeInstance(i: number, a: HerdAgent, time: number): void {
    const dance = a.settled
      ? 0.14 + Math.abs(Math.sin(time * 3 + i)) * 0.06
      : 0.06 + (a.wrongWay > 0 ? 0.12 : 0);
    const bob = Math.abs(Math.sin(time * (a.settled ? 7 : 5) + a.wanderAngle * 3)) * dance;
    this.dummy.position.set(a.x, 0.55 + bob, a.z);
    this.dummy.scale.set(1, 1 + bob * 0.5, 1);
    this.dummy.rotation.y = Math.atan2(a.vx, a.vz || 0.001);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(i, this.dummy.matrix);

    // Glow stick / flag
    const wave = Math.sin(time * 6 + i) * 0.5;
    this.propDummy.position.set(a.x + 0.25, 1.35 + bob + Math.abs(wave) * 0.1, a.z);
    this.propDummy.rotation.set(wave * 0.4, a.wanderAngle, 0.2);
    this.propDummy.scale.set(1, 1, 1);
    this.propDummy.updateMatrix();
    this.propMesh.setMatrixAt(i, this.propDummy.matrix);

    const hue = this.hues[i] ?? 0;
    const c = new THREE.Color().setHSL(
      hue,
      0.8,
      0.48 + (a.settled ? 0.12 : a.wrongWay > 0 ? 0.1 : 0),
    );
    this.colors.setXYZ(i, c.r, c.g, c.b);
  }
}
