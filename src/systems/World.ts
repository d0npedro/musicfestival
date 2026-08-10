import * as THREE from 'three';
import { GENRE_STAGES, WORLD_HALF } from '../logic/constants';
import type { AABB } from '../logic/collision';
import { makeBox } from '../logic/collision';
import type { PlayerStageState, StageModule } from '../logic/buildGrid';

export class World {
  readonly root = new THREE.Group();
  readonly obstacles: AABB[] = [];
  readonly stageLights: { id: string; light: THREE.PointLight; mesh: THREE.Mesh }[] = [];
  readonly playerModuleMeshes = new Map<string, THREE.Object3D>();
  private plotGroup = new THREE.Group();
  private groundMat: THREE.MeshStandardMaterial;
  private pathMat: THREE.MeshStandardMaterial;

  constructor() {
    // Dusty festival ground — trampled dirt at dusk
    this.groundMat = new THREE.MeshStandardMaterial({
      color: 0x6b5a3e,
      roughness: 0.98,
      metalness: 0.02,
    });
    this.pathMat = new THREE.MeshStandardMaterial({
      color: 0x8a7348,
      roughness: 0.95,
    });
    this.buildTerrain();
    this.buildPlaza();
    this.buildStages();
    this.buildProps();
    this.buildHerdZones();
    this.root.add(this.plotGroup);
  }

  private buildTerrain(): void {
    const size = WORLD_HALF * 2 + 20;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size, 48, 48),
      this.groundMat,
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.root.add(ground);

    // Dust patches
    for (let i = 0; i < 18; i++) {
      const patch = new THREE.Mesh(
        new THREE.CircleGeometry(4 + Math.random() * 8, 12),
        new THREE.MeshStandardMaterial({
          color: 0x9a8560,
          roughness: 1,
          transparent: true,
          opacity: 0.55,
        }),
      );
      patch.rotation.x = -Math.PI / 2;
      patch.position.set(
        (Math.random() - 0.5) * 140,
        0.03,
        10 + Math.random() * 70,
      );
      this.root.add(patch);
    }

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(95, 100, 64),
      new THREE.MeshStandardMaterial({ color: 0x3a3020, roughness: 1 }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    this.root.add(ring);
  }

  /** Glowing dancefloor zones — target for herding. */
  private buildHerdZones(): void {
    for (const s of GENRE_STAGES) {
      const zone = new THREE.Mesh(
        new THREE.CircleGeometry(s.zoneRadius, 40),
        new THREE.MeshStandardMaterial({
          color: s.color,
          emissive: s.color,
          emissiveIntensity: 0.25,
          transparent: true,
          opacity: 0.22,
          roughness: 0.5,
          metalness: 0.2,
        }),
      );
      zone.rotation.x = -Math.PI / 2;
      zone.position.set(s.x, 0.07, s.z + 8);
      this.root.add(zone);

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(s.zoneRadius - 0.4, s.zoneRadius, 48),
        new THREE.MeshBasicMaterial({
          color: s.color,
          transparent: true,
          opacity: 0.65,
          side: THREE.DoubleSide,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(s.x, 0.09, s.z + 8);
      this.root.add(ring);
    }
  }

  private buildPlaza(): void {
    const plaza = new THREE.Mesh(
      new THREE.CircleGeometry(16, 48),
      new THREE.MeshStandardMaterial({ color: 0x3a3a48, roughness: 0.85, metalness: 0.1 }),
    );
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = 0.03;
    plaza.receiveShadow = true;
    this.root.add(plaza);

    const fountain = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.5, 0.6, 16),
      new THREE.MeshStandardMaterial({
        color: 0x2bfff0,
        emissive: 0x114455,
        metalness: 0.6,
        roughness: 0.3,
      }),
    );
    fountain.position.y = 0.3;
    this.root.add(fountain);
    this.obstacles.push(makeBox(0, 0, 1.6, 1.6));
  }

  private buildStages(): void {
    for (const s of GENRE_STAGES) {
      const group = new THREE.Group();
      group.position.set(s.x, 0, s.z);

      // path from plaza
      const pathLen = Math.hypot(s.x, s.z);
      const path = new THREE.Mesh(
        new THREE.PlaneGeometry(4, pathLen - 18),
        this.pathMat,
      );
      path.rotation.x = -Math.PI / 2;
      path.position.set(s.x * 0.45, 0.04, s.z * 0.45);
      path.lookAt(new THREE.Vector3(s.x, 0.04, s.z));
      path.rotateX(-Math.PI / 2);
      // simpler: orient path by atan2
      path.rotation.set(-Math.PI / 2, 0, -Math.atan2(s.x, s.z));
      this.root.add(path);

      // platform
      const platform = new THREE.Mesh(
        new THREE.BoxGeometry(18, 0.8, 12),
        new THREE.MeshStandardMaterial({
          color: 0x222230,
          roughness: 0.7,
          metalness: 0.25,
        }),
      );
      platform.position.y = 0.4;
      platform.castShadow = true;
      platform.receiveShadow = true;
      group.add(platform);
      this.obstacles.push(makeBox(s.x, s.z, 9.2, 6.2));

      // truss roof
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(20, 0.3, 14),
        new THREE.MeshStandardMaterial({
          color: s.color,
          emissive: s.color,
          emissiveIntensity: 0.15,
          metalness: 0.5,
          roughness: 0.4,
        }),
      );
      roof.position.y = 7;
      group.add(roof);

      // poles
      for (const [px, pz] of [
        [-9, -6],
        [9, -6],
        [-9, 6],
        [9, 6],
      ] as const) {
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.2, 0.25, 7, 8),
          new THREE.MeshStandardMaterial({ color: 0x888899, metalness: 0.7 }),
        );
        pole.position.set(px, 3.5, pz);
        group.add(pole);
      }

      // speakers
      const spMat = new THREE.MeshStandardMaterial({ color: 0x111118, roughness: 0.5 });
      for (const sx of [-6, 6]) {
        const sp = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 2), spMat);
        sp.position.set(sx, 2.2, -4);
        group.add(sp);
      }

      // LED backdrop
      const led = new THREE.Mesh(
        new THREE.PlaneGeometry(14, 5),
        new THREE.MeshStandardMaterial({
          color: s.color,
          emissive: s.color,
          emissiveIntensity: 0.8,
          side: THREE.DoubleSide,
        }),
      );
      led.position.set(0, 4, -5.5);
      group.add(led);

      // sign
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 128;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#0a0a12';
      ctx.fillRect(0, 0, 512, 128);
      ctx.fillStyle = `#${s.color.toString(16).padStart(6, '0')}`;
      ctx.font = 'bold 48px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(s.name, 256, 64);
      const signTex = new THREE.CanvasTexture(canvas);
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(10, 2.5),
        new THREE.MeshBasicMaterial({ map: signTex, transparent: true }),
      );
      sign.position.set(0, 8.5, 0);
      group.add(sign);

      // stage light
      const light = new THREE.PointLight(s.color, 2.5, 45, 2);
      light.position.set(0, 6, 0);
      group.add(light);
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 12, 12),
        new THREE.MeshStandardMaterial({
          color: s.color,
          emissive: s.color,
          emissiveIntensity: 1.2,
        }),
      );
      bulb.position.copy(light.position);
      group.add(bulb);
      this.stageLights.push({ id: s.id, light, mesh: bulb });

      // dancefloor in front
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(20, 16),
        new THREE.MeshStandardMaterial({
          color: 0x1a1a28,
          emissive: s.secondary,
          emissiveIntensity: 0.08,
          roughness: 0.4,
          metalness: 0.3,
        }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(0, 0.05, 10);
      group.add(floor);

      this.root.add(group);
    }
  }

  private buildProps(): void {
    const tentMat = new THREE.MeshStandardMaterial({ color: 0x886644, roughness: 0.9 });
    const positions: [number, number][] = [
      [25, -15],
      [-30, 10],
      [15, 40],
      [-20, -40],
      [40, 25],
      [-45, 5],
      [5, -35],
      [-15, 30],
    ];
    for (const [x, z] of positions) {
      const tent = new THREE.Mesh(new THREE.ConeGeometry(3, 3.5, 4), tentMat);
      tent.position.set(x, 1.75, z);
      tent.rotation.y = Math.random() * Math.PI;
      this.root.add(tent);
      this.obstacles.push(makeBox(x, z, 2.2, 2.2));
    }

    // trees
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3020 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x1f5a2e });
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      const r = 85 + (i % 5) * 4;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 3, 6), trunkMat);
      trunk.position.set(x, 1.5, z);
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(2.2, 4, 7), leafMat);
      leaf.position.set(x, 4.2, z);
      this.root.add(trunk, leaf);
    }

    // barriers near stages
    const barMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.5 });
    for (const s of GENRE_STAGES) {
      for (let i = -3; i <= 3; i++) {
        if (i === 0) continue;
        const b = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1, 0.2), barMat);
        const ang = Math.atan2(s.x, s.z);
        const px = s.x + Math.cos(ang) * 8 + Math.sin(ang) * i * 2;
        const pz = s.z + Math.sin(ang) * 8 - Math.cos(ang) * i * 2;
        b.position.set(px, 0.5, pz);
        b.rotation.y = ang;
        this.root.add(b);
      }
    }
  }



  syncPlayerStage(state: PlayerStageState): void {
    const ids = new Set(state.modules.map((m) => m.id));
    for (const [id, mesh] of this.playerModuleMeshes) {
      if (!ids.has(id)) {
        this.plotGroup.remove(mesh);
        this.playerModuleMeshes.delete(id);
      }
    }
    for (const m of state.modules) {
      let obj = this.playerModuleMeshes.get(m.id);
      if (!obj) {
        obj = this.createModuleMesh(m);
        this.playerModuleMeshes.set(m.id, obj);
        this.plotGroup.add(obj);
      }
      obj.position.set(m.x, 0, m.z);
      obj.rotation.y = m.rotY;
      this.applyModuleStyle(obj, m);
    }
  }

  private createModuleMesh(m: StageModule): THREE.Object3D {
    const g = new THREE.Group();
    g.userData.moduleId = m.id;
    g.userData.moduleType = m.type;
    const col = m.color ? new THREE.Color(m.color) : new THREE.Color(0xff2bd6);

    switch (m.type) {
      case 'deck': {
        const deck = new THREE.Mesh(
          new THREE.BoxGeometry(2.5, 1, 1.5),
          new THREE.MeshStandardMaterial({ color: 0x222233, metalness: 0.4 }),
        );
        deck.position.y = 0.5;
        const top = new THREE.Mesh(
          new THREE.BoxGeometry(2.2, 0.1, 1.2),
          new THREE.MeshStandardMaterial({
            color: 0x111122,
            emissive: 0x2bfff0,
            emissiveIntensity: 0.3,
          }),
        );
        top.position.y = 1.05;
        g.add(deck, top);
        break;
      }
      case 'speakers': {
        const sp = new THREE.Mesh(
          new THREE.BoxGeometry(1.2, 2.2, 1.2),
          new THREE.MeshStandardMaterial({ color: 0x111118 }),
        );
        sp.position.y = 1.1;
        g.add(sp);
        break;
      }
      case 'lightPole': {
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 0.15, 4, 8),
          new THREE.MeshStandardMaterial({ color: 0x888899, metalness: 0.6 }),
        );
        pole.position.y = 2;
        const light = new THREE.PointLight(col, 1.5, 20, 2);
        light.position.y = 4.2;
        const bulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.25, 10, 10),
          new THREE.MeshStandardMaterial({
            color: col,
            emissive: col,
            emissiveIntensity: 1,
          }),
        );
        bulb.position.y = 4.2;
        g.add(pole, light, bulb);
        g.userData.light = light;
        g.userData.bulb = bulb;
        break;
      }
      case 'ledWall': {
        const wall = new THREE.Mesh(
          new THREE.BoxGeometry(4, 3, 0.3),
          new THREE.MeshStandardMaterial({
            color: col,
            emissive: col,
            emissiveIntensity: 0.9,
          }),
        );
        wall.position.y = 1.5;
        g.add(wall);
        g.userData.led = wall;
        break;
      }
      case 'dancefloor': {
        const tile = new THREE.Mesh(
          new THREE.BoxGeometry(1.9, 0.1, 1.9),
          new THREE.MeshStandardMaterial({
            color: 0x1a1030,
            emissive: col,
            emissiveIntensity: 0.25,
            metalness: 0.4,
            roughness: 0.35,
          }),
        );
        tile.position.y = 0.08;
        g.add(tile);
        g.userData.tile = tile;
        break;
      }
    }
    return g;
  }

  private applyModuleStyle(obj: THREE.Object3D, m: StageModule): void {
    const col = m.color ? new THREE.Color(m.color) : new THREE.Color(0xff2bd6);
    if (obj.userData.light instanceof THREE.PointLight) {
      obj.userData.light.color.copy(col);
    }
    if (obj.userData.bulb instanceof THREE.Mesh) {
      const mat = obj.userData.bulb.material as THREE.MeshStandardMaterial;
      mat.color.copy(col);
      mat.emissive.copy(col);
    }
    if (obj.userData.led instanceof THREE.Mesh) {
      const mat = obj.userData.led.material as THREE.MeshStandardMaterial;
      mat.color.copy(col);
      mat.emissive.copy(col);
    }
    if (obj.userData.tile instanceof THREE.Mesh) {
      const mat = obj.userData.tile.material as THREE.MeshStandardMaterial;
      mat.emissive.copy(col);
    }
  }

  updateStageLights(intensityById: Record<string, number>, night: number, time: number): void {
    for (const s of this.stageLights) {
      const i = intensityById[s.id] ?? 0.3;
      const pulse = 0.7 + Math.sin(time * 4 + s.light.position.x) * 0.3 * i;
      s.light.intensity = (1.2 + i * 4) * (0.5 + night * 0.8) * pulse;
      const mat = s.mesh.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.5 + i * 1.5 * pulse;
    }
  }

  updatePlayerLights(
    state: PlayerStageState,
    beat: number,
    time: number,
  ): void {
    for (const m of state.modules) {
      const obj = this.playerModuleMeshes.get(m.id);
      if (!obj) continue;
      const mode = m.lightMode ?? 'static';
      let intensity = 1;
      if (mode === 'pulse') intensity = 0.5 + Math.sin(time * 5) * 0.5;
      if (mode === 'beat') intensity = 0.35 + beat * 0.9;
      if (obj.userData.light instanceof THREE.PointLight) {
        obj.userData.light.intensity = 0.8 + intensity * 2;
      }
      if (obj.userData.led instanceof THREE.Mesh) {
        (obj.userData.led.material as THREE.MeshStandardMaterial).emissiveIntensity =
          0.3 + intensity;
      }
      if (obj.userData.tile instanceof THREE.Mesh) {
        (obj.userData.tile.material as THREE.MeshStandardMaterial).emissiveIntensity =
          0.1 + intensity * 0.4;
      }
    }
  }
}
