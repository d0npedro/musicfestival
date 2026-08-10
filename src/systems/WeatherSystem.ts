import * as THREE from 'three';
import type { WeatherType } from '../logic/constants';
import {
  advanceWeather,
  createWeather,
  shelterBias,
  weatherVisual,
  type WeatherState,
} from '../logic/weather';

export class WeatherSystem {
  state: WeatherState = createWeather('clear');
  private rain: THREE.Points;
  private rainGeo: THREE.BufferGeometry;
  private rainPositions: Float32Array;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    const count = 4000;
    this.rainPositions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      this.rainPositions[i * 3] = (Math.random() - 0.5) * 160;
      this.rainPositions[i * 3 + 1] = Math.random() * 40;
      this.rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 160;
    }
    this.rainGeo = new THREE.BufferGeometry();
    this.rainGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(this.rainPositions, 3),
    );
    const mat = new THREE.PointsMaterial({
      color: 0xaaccff,
      size: 0.15,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    this.rain = new THREE.Points(this.rainGeo, mat);
    this.rain.visible = false;
    scene.add(this.rain);
  }

  setState(state: WeatherState): void {
    this.state = { ...state };
  }

  setType(type: WeatherType): void {
    this.state = { type, blend: 1, nextChangeIn: 50 };
  }

  update(dt: number, playerX: number, playerZ: number): void {
    this.state = advanceWeather(this.state, dt);
    const vis = weatherVisual(this.state);
    this.scene.fog = new THREE.FogExp2(0x1a1a28, vis.fogDensity);

    const mat = this.rain.material as THREE.PointsMaterial;
    if (vis.rain > 0.05) {
      this.rain.visible = true;
      mat.opacity = 0.35 + vis.rain * 0.45;
      this.rain.position.set(playerX, 0, playerZ);
      for (let i = 0; i < this.rainPositions.length / 3; i++) {
        this.rainPositions[i * 3 + 1]! -= (12 + vis.rain * 25) * dt;
        if (this.rainPositions[i * 3 + 1]! < 0) {
          this.rainPositions[i * 3 + 1] = 30 + Math.random() * 15;
        }
      }
      this.rainGeo.attributes.position!.needsUpdate = true;
    } else {
      this.rain.visible = false;
    }
  }

  get visual() {
    return weatherVisual(this.state);
  }

  get shelter(): number {
    return shelterBias(this.state);
  }

  get label(): string {
    return this.state.type.charAt(0).toUpperCase() + this.state.type.slice(1);
  }
}
