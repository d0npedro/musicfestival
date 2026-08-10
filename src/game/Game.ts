import * as THREE from 'three';
import { CROWD_COUNT, DUSK_PHASE, GENRE_STAGES } from '../logic/constants';
import {
  advanceMissionTime,
  createMission,
  withHerdCount,
  type MissionState,
} from '../logic/herding';
import { Input } from '../systems/Input';
import { Player } from '../systems/Player';
import { CameraFollow } from '../systems/CameraFollow';
import { World } from '../systems/World';
import { AudioEngine } from '../systems/AudioEngine';
import { DayNightSystem } from '../systems/DayNightSystem';
import { WeatherSystem } from '../systems/WeatherSystem';
import { Crowd } from '../systems/Crowd';
import { FxSystem } from '../systems/FxSystem';
import { Hud } from '../ui/hud';

/**
 * Chaos herding: one security guard, hundreds of drunk ravers, 5 minutes
 * before the headliner — drive the flock to the main stages.
 */
export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private input: Input;
  readonly player = new Player();
  private camFollow: CameraFollow;
  private world = new World();
  private audio = new AudioEngine();
  private dayNight: DayNightSystem;
  private weather: WeatherSystem;
  private crowd: Crowd;
  private fx: FxSystem;
  private hud: Hud;

  private running = false;
  private lastT = 0;
  private mission: MissionState = createMission(CROWD_COUNT);
  private shoutCooldownToast = 0;
  private canvas: HTMLCanvasElement;
  private lasers: THREE.Mesh[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.camera = new THREE.PerspectiveCamera(
      58,
      window.innerWidth / window.innerHeight,
      0.1,
      400,
    );
    this.camFollow = new CameraFollow(this.camera);
    this.input = new Input(canvas);

    this.scene.background = new THREE.Color(0x1a1028);
    this.scene.fog = new THREE.FogExp2(0x2a1a28, 0.006);
    this.scene.add(this.world.root);
    this.scene.add(this.player.mesh);

    this.dayNight = new DayNightSystem(this.scene);
    this.weather = new WeatherSystem(this.scene);
    this.crowd = new Crowd(this.scene);
    this.fx = new FxSystem(this.scene);
    this.buildLasers();

    // Fixed dusk — desperate pre-headliner light
    this.dayNight.setPhase(DUSK_PHASE);
    this.dayNight.applyVisuals(0.85);
    this.weather.setType('clear');

    this.player.setPose(0, 42, Math.PI);
    this.camFollow.yaw = 0.05;
    this.camFollow.pitch = 0.52;

    this.hud = new Hud({
      onVolume: (v) => this.audio.setMasterVolume(v),
      onRestart: () => this.restartMission(),
    });

    this.hud.onEnter(() => void this.enterFestival());
    window.addEventListener('resize', () => this.onResize());

    this.camFollow.update(this.player);
    this.renderer.render(this.scene, this.camera);
  }

  private buildLasers(): void {
    for (const s of GENRE_STAGES) {
      for (let i = 0; i < 3; i++) {
        const col = new THREE.Color(s.color);
        const beam = new THREE.Mesh(
          new THREE.CylinderGeometry(0.06, 0.06, 45, 5),
          new THREE.MeshBasicMaterial({
            color: col,
            transparent: true,
            opacity: 0.35,
            depthWrite: false,
          }),
        );
        beam.position.set(s.x + (i - 1) * 3, 12, s.z);
        beam.rotation.z = (i - 1) * 0.25;
        beam.rotation.x = 0.4 + i * 0.1;
        this.scene.add(beam);
        this.lasers.push(beam);
      }
    }
  }

  private async enterFestival(): Promise<void> {
    await this.audio.start();
    this.audio.setMasterVolume(
      Number((document.getElementById('master-vol') as HTMLInputElement).value),
    );
    // Place player near stages for loud beds
    this.audio.setPlayerPosition(this.player.position.x, this.player.position.z);
    this.hud.hideGate();
    this.hud.hideEnd();
    this.hud.showToast('Radio: "Get those ravers to the stages — FIVE MINUTES!"');
    this.mission = createMission(CROWD_COUNT);
    this.running = true;
    this.lastT = performance.now();
    this.canvas.focus();
    requestAnimationFrame((t) => this.loop(t));
  }

  private restartMission(): void {
    this.crowd.scatterField();
    this.player.setPose(0, 42, Math.PI);
    this.mission = createMission(CROWD_COUNT);
    this.hud.hideEnd();
    this.hud.showToast('Radio: "Reset — round them up AGAIN!"');
    this.lastT = performance.now();
    // Loop already running after first Start Shift
    if (!this.running) {
      this.running = true;
      requestAnimationFrame((t) => this.loop(t));
    }
  }

  private loop(t: number): void {
    if (!this.running) return;
    const dt = Math.min(0.05, (t - this.lastT) / 1000);
    this.lastT = t;
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
    if (this.running) requestAnimationFrame((nt) => this.loop(nt));
  }

  private update(dt: number): void {
    if (this.mission.status !== 'playing') {
      // Still allow camera look on end screen
      const mouse = this.input.consumeMouse();
      this.camFollow.applyLook(mouse.dx, mouse.dy);
      this.camFollow.update(this.player);
      this.animateLasers(dt);
      this.fx.update(dt);
      this.input.endFrame();
      return;
    }

    const mouse = this.input.consumeMouse();
    this.camFollow.applyLook(mouse.dx, mouse.dy);

    this.player.update(dt, this.input, this.camFollow.yaw, this.world.obstacles);
    const guard = this.player.getGuardState();

    this.crowd.update(dt, guard);

    // Mission scoring
    const herded = this.crowd.herdedCount();
    this.mission = withHerdCount(this.mission, herded);
    this.mission = advanceMissionTime(this.mission, dt);

    // Atmosphere locked dusk + dusty haze
    this.dayNight.setPhase(DUSK_PHASE);
    this.dayNight.applyVisuals(0.8 + Math.sin(performance.now() * 0.001) * 0.05);
    this.weather.update(dt * 0.25, this.player.position.x, this.player.position.z);

    this.audio.setDayPhase(DUSK_PHASE);
    this.audio.setPlayerPosition(this.player.position.x, this.player.position.z);
    this.audio.update();

    const intensities = GENRE_STAGES.map((s) => this.audio.getIntensity(s.id));
    const intensityMap: Record<string, number> = {};
    GENRE_STAGES.forEach((s, i) => {
      intensityMap[s.id] = intensities[i] ?? 0.5;
    });
    this.world.updateStageLights(intensityMap, 0.85, performance.now() * 0.001);

    // Stage FX pulse
    this.animateLasers(dt);
    this.fx.update(dt);

    if (guard.shout > 0.9 && this.shoutCooldownToast <= 0) {
      this.fx.triggerAt(this.player.position.x, 1.5, this.player.position.z, 'strobe');
      this.hud.showToast(randomShout(), 1400);
      this.shoutCooldownToast = 1.2;
    }
    this.shoutCooldownToast = Math.max(0, this.shoutCooldownToast - dt);

    if (this.input.pressed('KeyH')) this.hud.toggleHelp();

    this.camFollow.update(this.player);

    this.hud.setMission(
      this.mission.timeLeft,
      this.mission.herded,
      this.mission.total,
      this.mission.ratio,
    );
    this.hud.setStatus(
      guard.armsOpen
        ? 'ARMS WIDE — driving the flock'
        : guard.shout > 0.2
          ? 'RADIO SHOUT!'
          : 'Jog · Space herd · E shout',
    );
    this.hud.setPrompt(
      guard.armsOpen
        ? 'Shepherd mode — push with your body'
        : 'Hold SPACE — arms open  ·  E — radio shout',
    );
    this.hud.drawMinimap(
      this.player.position.x,
      this.player.position.z,
      this.player.yaw,
      this.crowd.getAgents(),
    );

    if (this.mission.status === 'won') {
      this.running = true; // keep rendering
      this.hud.showEnd(true, this.mission.herded, this.mission.total);
      this.fx.triggerAt(this.player.position.x, 2, this.player.position.z, 'confetti');
      // freeze mission updates by status
    } else if (this.mission.status === 'lost') {
      this.hud.showEnd(false, this.mission.herded, this.mission.total);
    }

    // Stop gameplay updates but keep loop for end screen
    if (this.mission.status !== 'playing') {
      // mark so update takes early branch next frames — status handles it
    }

    this.input.endFrame();
  }

  private animateLasers(dt: number): void {
    const t = performance.now() * 0.001;
    for (let i = 0; i < this.lasers.length; i++) {
      const L = this.lasers[i]!;
      L.rotation.y += dt * (0.4 + (i % 3) * 0.2);
      L.rotation.z = Math.sin(t * 1.5 + i) * 0.35;
      const mat = L.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.22 + Math.sin(t * 3 + i) * 0.12;
    }
  }

  private onResize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  getDebugState(): {
    playerX: number;
    playerZ: number;
    yaw: number;
    dayPhase: number;
    weather: string;
    running: boolean;
    timeLeft: number;
    herded: number;
  } {
    return {
      playerX: this.player.position.x,
      playerZ: this.player.position.z,
      yaw: this.player.yaw,
      dayPhase: DUSK_PHASE,
      weather: this.weather.state.type,
      running: this.running,
      timeLeft: this.mission.timeLeft,
      herded: this.mission.herded,
    };
  }
}

const SHOUTS = [
  'MOVE TO THE STAGE — PLEASE!',
  'This is not a drum circle!',
  'Glow sticks DOWN, bodies FORWARD!',
  'Radio: "Where is everyone?!"',
  "You're going the WRONG way!",
  'Herd instinct… activate!',
  'Five minutes! FIVE!',
  'Security! …just me actually!',
];

function randomShout(): string {
  return SHOUTS[Math.floor(Math.random() * SHOUTS.length)] ?? 'MOVE!';
}
