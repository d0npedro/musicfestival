import * as THREE from 'three';
import { CROWD_COUNT, GENRE_STAGES, WORLD_HALF } from '../logic/constants';
import {
  blendIntensity,
  danceAmplitude,
  danceSpeed,
  stageAttraction,
  wanderSpeed,
  weatherSlowFactor,
} from '../logic/crowdLogic';

type Agent = {
  x: number;
  z: number;
  vx: number;
  vz: number;
  phase: number;
  hue: number;
  targetStage: number;
};

export class Crowd {
  private mesh: THREE.InstancedMesh;
  private agents: Agent[] = [];
  private dummy = new THREE.Object3D();
  private colors: THREE.InstancedBufferAttribute;
  private intensityMap: number[] = GENRE_STAGES.map(() => 0.3);

  constructor(scene: THREE.Scene) {
    const geo = new THREE.CapsuleGeometry(0.25, 0.5, 3, 6);
    const mat = new THREE.MeshStandardMaterial({
      roughness: 0.7,
      metalness: 0.1,
      vertexColors: true,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, CROWD_COUNT);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;

    const colorArray = new Float32Array(CROWD_COUNT * 3);
    this.colors = new THREE.InstancedBufferAttribute(colorArray, 3);
    this.mesh.instanceColor = this.colors;

    for (let i = 0; i < CROWD_COUNT; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r = 8 + Math.random() * 90;
      const agent: Agent = {
        x: Math.cos(ang) * r,
        z: Math.sin(ang) * r,
        vx: 0,
        vz: 0,
        phase: Math.random() * Math.PI * 2,
        hue: Math.random(),
        targetStage: Math.floor(Math.random() * GENRE_STAGES.length),
      };
      this.agents.push(agent);
      const c = new THREE.Color().setHSL(agent.hue, 0.55, 0.45);
      this.colors.setXYZ(i, c.r, c.g, c.b);
      this.dummy.position.set(agent.x, 0.7, agent.z);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    scene.add(this.mesh);
  }

  setStageIntensities(intensities: number[]): void {
    this.intensityMap = intensities;
  }

  update(
    dt: number,
    playerX: number,
    playerZ: number,
    localIntensity: number,
    cloudiness: number,
    rain: number,
    shelterBias: number,
  ): void {
    const wSlow = weatherSlowFactor(cloudiness, rain);
    const time = performance.now() * 0.001;

    for (let i = 0; i < this.agents.length; i++) {
      const a = this.agents[i]!;
      // nearest / assigned stage intensity
      let bestI = 0;
      let bestD = Infinity;
      let tx = 0;
      let tz = 0;
      for (let s = 0; s < GENRE_STAGES.length; s++) {
        const st = GENRE_STAGES[s]!;
        const d = Math.hypot(st.x - a.x, st.z - a.z);
        const bi = blendIntensity(this.intensityMap[s] ?? 0.3, d, 50);
        if (bi > bestI || d < bestD) {
          if (d < bestD) {
            bestD = d;
            tx = st.x;
            tz = st.z + 10;
          }
          bestI = Math.max(bestI, bi);
        }
      }
      // player stage influence
      const pI = blendIntensity(localIntensity, Math.hypot(playerX - a.x, playerZ - a.z), 25);
      const intensity = Math.max(bestI, pI);

      const attract = stageAttraction(intensity);
      const speed = wanderSpeed(intensity, wSlow);

      // shelter tents bias in rain
      if (shelterBias > 0.1 && Math.random() < shelterBias * dt * 0.5) {
        // nudge toward origin-ish plaza tents
        tx = a.x * 0.3;
        tz = a.z * 0.3;
      }

      if (Math.random() < 0.02) a.targetStage = Math.floor(Math.random() * GENRE_STAGES.length);
      const prefer = GENRE_STAGES[a.targetStage] ?? GENRE_STAGES[0]!;
      const goalX = attract > 0.4 ? prefer.x : tx + (Math.random() - 0.5) * 20;
      const goalZ = attract > 0.4 ? prefer.z + 12 : tz + (Math.random() - 0.5) * 20;

      const dx = goalX - a.x;
      const dz = goalZ - a.z;
      const dist = Math.hypot(dx, dz) || 1;
      a.vx = (dx / dist) * speed * (0.4 + attract);
      a.vz = (dz / dist) * speed * (0.4 + attract);

      // avoid player
      const pdx = a.x - playerX;
      const pdz = a.z - playerZ;
      const pd = Math.hypot(pdx, pdz);
      if (pd < 3 && pd > 0.01) {
        a.vx += (pdx / pd) * 4;
        a.vz += (pdz / pd) * 4;
      }

      a.x += a.vx * dt;
      a.z += a.vz * dt;
      const bound = WORLD_HALF - 5;
      a.x = Math.max(-bound, Math.min(bound, a.x));
      a.z = Math.max(-bound, Math.min(bound, a.z));

      a.phase += dt * danceSpeed(intensity);
      const amp = danceAmplitude(intensity);
      const bob = Math.abs(Math.sin(a.phase + time)) * amp;
      const scaleY = 1 + bob * 0.8;

      this.dummy.position.set(a.x, 0.55 + bob, a.z);
      this.dummy.scale.set(1, scaleY, 1);
      this.dummy.rotation.y = Math.atan2(a.vx, a.vz);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);

      // emissive-ish tint via color brighten near intensity
      const c = new THREE.Color().setHSL(a.hue, 0.55, 0.35 + intensity * 0.25);
      this.colors.setXYZ(i, c.r, c.g, c.b);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
