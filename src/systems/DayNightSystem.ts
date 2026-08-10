import * as THREE from 'three';
import {
  advanceDayPhase,
  dayPeriod,
  nightBoost,
  sunDirection,
  sunElevationFactor,
} from '../logic/dayNight';
import type { DayPeriod } from '../logic/dayNight';

export class DayNightSystem {
  phase = 0.35;
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly ambient: THREE.AmbientLight;
  private sky: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;

  constructor(scene: THREE.Scene) {
    this.sun = new THREE.DirectionalLight(0xfff2dd, 1.2);
    this.sun.position.set(50, 80, 20);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 250;
    this.sun.shadow.camera.left = -80;
    this.sun.shadow.camera.right = 80;
    this.sun.shadow.camera.top = 80;
    this.sun.shadow.camera.bottom = -80;
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.hemi = new THREE.HemisphereLight(0x88aaff, 0x334422, 0.45);
    scene.add(this.hemi);

    this.ambient = new THREE.AmbientLight(0x445566, 0.25);
    scene.add(this.ambient);

    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x2244aa) },
        bottomColor: { value: new THREE.Color(0x88aadd) },
        offset: { value: 20 },
        exponent: { value: 0.6 },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + offset).y;
          float t = max(pow(max(h, 0.0), exponent), 0.0);
          gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
        }
      `,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), this.skyMat);
    scene.add(this.sky);
  }

  setPhase(phase: number): void {
    this.phase = ((phase % 1) + 1) % 1;
  }

  update(dt: number): void {
    this.phase = advanceDayPhase(this.phase, dt);
    this.applyVisuals(1);
  }

  applyVisuals(weatherAmbientScale: number): void {
    const elev = sunElevationFactor(this.phase);
    const night = nightBoost(this.phase);
    const dir = sunDirection(this.phase);
    this.sun.position.set(dir.x * 100, dir.y * 100, dir.z * 100);
    this.sun.target.position.set(0, 0, 0);
    this.sun.intensity = (0.15 + elev * 1.3) * weatherAmbientScale;
    this.sun.color.setHSL(0.1, 0.3, 0.55 + elev * 0.35);

    this.hemi.intensity = (0.2 + elev * 0.4) * weatherAmbientScale;
    this.ambient.intensity = (0.12 + elev * 0.2 + night * 0.08) * weatherAmbientScale;

    const top = new THREE.Color().setHSL(0.6, 0.55, 0.08 + elev * 0.35);
    const bottom = new THREE.Color().setHSL(0.08 + elev * 0.05, 0.4, 0.15 + elev * 0.45);
    if (night > 0.7) {
      top.set(0x050518);
      bottom.set(0x12122a);
    }
    this.skyMat.uniforms.topColor.value.copy(top);
    this.skyMat.uniforms.bottomColor.value.copy(bottom);
  }

  get period(): DayPeriod {
    return dayPeriod(this.phase);
  }

  get night(): number {
    return nightBoost(this.phase);
  }
}
