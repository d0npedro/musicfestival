import * as THREE from 'three';
import { GENRE_STAGES, MODULE_TYPES, PLOT_CENTER, type ModuleType } from '../logic/constants';
import { nearestStageName } from '../logic/audioMix';
import {
  nearestModule,
  placeModule,
  removeModule,
  rotateModule,
  updateModule,
  type PlayerStageState,
} from '../logic/buildGrid';
import {
  clearPattern,
  cloneSequencer,
  setPlaying,
  setTempo,
  toggleStep,
} from '../logic/sequencer';
import {
  defaultSave,
  loadFromStorage,
  saveToStorage,
  type SaveGame,
} from '../logic/persistence';
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

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private input: Input;
  /** Exposed for automated verification / debug tooling. */
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
  private save: SaveGame = defaultSave();
  private playerStage: PlayerStageState;
  private buildMode = false;
  private selectedModule: ModuleType = 'deck';
  private ghostRot = 0;
  private activeLightId: string | null = null;
  private seqOpen = false;
  private autosaveAcc = 0;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private canvas: HTMLCanvasElement;

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
    this.renderer.toneMappingExposure = 1.05;

    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      400,
    );
    this.camFollow = new CameraFollow(this.camera);
    this.input = new Input(canvas);

    this.scene.background = new THREE.Color(0x0a0a14);
    this.scene.fog = new THREE.FogExp2(0x1a1a28, 0.004);
    this.scene.add(this.world.root);
    this.scene.add(this.player.mesh);

    this.dayNight = new DayNightSystem(this.scene);
    this.weather = new WeatherSystem(this.scene);
    this.crowd = new Crowd(this.scene);
    this.fx = new FxSystem(this.scene);

    this.playerStage = this.save.playerStage;

    this.hud = new Hud({
      onVolume: (v) => this.audio.setMasterVolume(v),
      onSeqToggle: (t, s) => this.onSeqToggle(t, s),
      onSeqPlay: () => this.onSeqPlay(),
      onSeqStop: () => this.onSeqStop(),
      onSeqClear: () => this.onSeqClear(),
      onSeqTempo: (bpm) => this.onSeqTempo(bpm),
      onBuildSelect: (type) => {
        this.selectedModule = type;
      },
      onLightApply: (color, mode) => this.onLightApply(color, mode),
      onLightClose: () => {
        this.activeLightId = null;
        this.hud.setLightPanel(false);
      },
    });

    this.hud.onEnter(() => void this.enterFestival());
    window.addEventListener('resize', () => this.onResize());
    canvas.addEventListener('click', (e) => this.onCanvasClick(e));

    this.load();
    this.world.syncPlayerStage(this.playerStage);
    this.hud.syncSequencer(this.playerStage.sequencer);
    // idle preview render before enter
    this.dayNight.setPhase(this.save.dayPhase);
    this.dayNight.applyVisuals(1);
    this.camFollow.update(this.player);
    this.renderer.render(this.scene, this.camera);
  }

  private load(): void {
    const loaded = loadFromStorage();
    if (loaded) {
      this.save = loaded;
      this.playerStage = loaded.playerStage;
      this.player.setPose(loaded.player.x, loaded.player.z, loaded.player.yaw);
      this.camFollow.yaw = loaded.player.yaw + 0.4;
      this.dayNight.setPhase(loaded.dayPhase);
      this.weather.setState(loaded.weather);
    } else {
      this.player.setPose(0, 8, 0);
    }
  }

  private persist(): void {
    this.save = {
      version: this.save.version,
      player: {
        x: this.player.position.x,
        y: 0,
        z: this.player.position.z,
        yaw: this.player.yaw,
      },
      dayPhase: this.dayNight.phase,
      weather: { ...this.weather.state },
      playerStage: {
        modules: this.playerStage.modules.map((m) => ({ ...m })),
        sequencer: cloneSequencer(this.playerStage.sequencer),
      },
      visitedStages: [...this.save.visitedStages],
    };
    saveToStorage(this.save);
  }

  private async enterFestival(): Promise<void> {
    await this.audio.start();
    this.audio.setMasterVolume(Number((document.getElementById('master-vol') as HTMLInputElement).value));
    this.audio.setPlayerSequencer(this.playerStage.sequencer);
    this.hud.hideGate();
    this.hud.showToast('Welcome to Neon Grounds');
    this.running = true;
    this.lastT = performance.now();
    this.canvas.focus();
    requestAnimationFrame((t) => this.loop(t));
  }

  private loop(t: number): void {
    if (!this.running) return;
    const dt = Math.min(0.05, (t - this.lastT) / 1000);
    this.lastT = t;
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame((nt) => this.loop(nt));
  }

  private update(dt: number): void {
    // camera look
    const mouse = this.input.consumeMouse();
    this.camFollow.applyLook(mouse.dx, mouse.dy);

    if (!this.seqOpen && !this.isTyping()) {
      this.player.update(dt, this.input, this.camFollow.yaw, this.world.obstacles);
    }

    this.handleHotkeys();

    this.dayNight.update(dt);
    this.weather.update(dt, this.player.position.x, this.player.position.z);
    this.dayNight.applyVisuals(this.weather.visual.ambientScale);

    this.audio.setDayPhase(this.dayNight.phase);
    this.audio.setPlayerPosition(this.player.position.x, this.player.position.z);
    this.audio.update();

    const intensities = GENRE_STAGES.map((s) => this.audio.getIntensity(s.id));
    this.crowd.setStageIntensities(intensities);
    const localI = this.audio.getLocalIntensity();
    this.crowd.update(
      dt,
      this.player.position.x,
      this.player.position.z,
      localI,
      this.weather.visual.cloudiness,
      this.weather.visual.rain,
      this.weather.shelter,
    );

    const intensityMap: Record<string, number> = {};
    GENRE_STAGES.forEach((s, i) => {
      intensityMap[s.id] = intensities[i] ?? 0;
    });
    this.world.updateStageLights(intensityMap, this.dayNight.night, tSeconds());
    this.world.updatePlayerLights(
      this.playerStage,
      this.audio.getBeatPulse(),
      tSeconds(),
    );
    this.fx.update(dt);

    this.camFollow.update(this.player);

    // visit tracking
    const near = nearestStageName(this.player.position.x, this.player.position.z);
    if (
      near.id !== 'plaza' &&
      near.id !== 'plot' &&
      near.dist < 25 &&
      !this.save.visitedStages.includes(near.id)
    ) {
      this.save.visitedStages.push(near.id);
    }

    this.hud.setTimeLabel(this.dayNight.period, this.dayNight.phase);
    this.hud.setWeather(this.weather.label);
    this.hud.setStage(near.name);
    this.hud.drawMinimap(this.player.position.x, this.player.position.z, this.player.yaw);
    this.updateInteractPrompt();

    if (this.seqOpen) {
      this.hud.syncSequencer(this.playerStage.sequencer);
    }

    this.autosaveAcc += dt;
    if (this.autosaveAcc > 20) {
      this.autosaveAcc = 0;
      this.persist();
    }

    this.input.endFrame();
  }

  private handleHotkeys(): void {
    if (this.isTyping()) return;

    if (this.input.pressed('KeyH')) this.hud.toggleHelp();
    if (this.input.pressed('KeyP')) {
      this.persist();
      this.hud.showToast('Game saved');
    }
    if (this.input.pressed('KeyB')) {
      this.buildMode = !this.buildMode;
      this.hud.setBuildMode(this.buildMode);
      this.hud.showToast(this.buildMode ? 'Build mode on' : 'Build mode off');
    }
    if (this.input.pressed('KeyR') && this.buildMode) {
      this.ghostRot += Math.PI / 2;
      const near = nearestModule(
        this.playerStage.modules,
        this.player.position.x,
        this.player.position.z,
        4,
      );
      if (near) {
        this.playerStage = rotateModule(this.playerStage, near.id);
        this.world.syncPlayerStage(this.playerStage);
        this.persist();
      }
    }
    if (this.input.pressed('KeyX') && this.buildMode) {
      const near = nearestModule(
        this.playerStage.modules,
        this.player.position.x,
        this.player.position.z,
        4,
      );
      if (near) {
        this.playerStage = removeModule(this.playerStage, near.id);
        this.world.syncPlayerStage(this.playerStage);
        this.persist();
        this.hud.showToast('Removed module');
      }
    }
    if (this.input.pressed('KeyF')) {
      this.fx.triggerAt(
        this.player.position.x,
        1,
        this.player.position.z,
        'laser',
      );
      this.fx.triggerAt(
        this.player.position.x,
        1,
        this.player.position.z,
        'strobe',
      );
    }
    // module hotkeys 1-5
    for (let i = 0; i < MODULE_TYPES.length; i++) {
      if (this.input.pressed(`Digit${i + 1}`)) {
        this.selectedModule = MODULE_TYPES[i]!;
        this.hud.setBuildMode(true);
        this.buildMode = true;
      }
    }
    if (this.input.pressed('KeyE')) this.tryInteract();
  }

  private updateInteractPrompt(): void {
    const px = this.player.position.x;
    const pz = this.player.position.z;
    const mod = nearestModule(this.playerStage.modules, px, pz, 3.5);
    if (mod?.type === 'deck') {
      this.hud.setPrompt('Press E — Sequencer');
      return;
    }
    if (mod?.type === 'lightPole' || mod?.type === 'ledWall') {
      this.hud.setPrompt('Press E — Lights');
      return;
    }
    // near player plot without modules
    if (Math.hypot(px - PLOT_CENTER.x, pz - PLOT_CENTER.z) < PLOT_CENTER.x) {
      // fallthrough
    }
    if (Math.hypot(px - PLOT_CENTER.x, pz - PLOT_CENTER.z) < 12) {
      this.hud.setPrompt(this.buildMode ? 'Click to place · B exit build' : 'Press B — Build mode');
      return;
    }
    // near any genre stage dancefloor for FX
    for (const s of GENRE_STAGES) {
      if (Math.hypot(px - s.x, pz - (s.z + 10)) < 12) {
        this.hud.setPrompt('Press F — Stage FX');
        return;
      }
    }
    this.hud.setPrompt(null);
  }

  private tryInteract(): void {
    const px = this.player.position.x;
    const pz = this.player.position.z;
    const mod = nearestModule(this.playerStage.modules, px, pz, 3.5);
    if (mod?.type === 'deck') {
      this.seqOpen = !this.seqOpen;
      this.hud.setSequencerOpen(this.seqOpen);
      this.hud.syncSequencer(this.playerStage.sequencer);
      return;
    }
    if (mod && (mod.type === 'lightPole' || mod.type === 'ledWall')) {
      this.activeLightId = mod.id;
      this.hud.setLightPanel(true, mod.color ?? '#ff00aa', mod.lightMode ?? 'beat');
      return;
    }
  }

  private onCanvasClick(e: MouseEvent): void {
    if (!this.running || !this.buildMode) return;
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, hit)) return;
    const next = placeModule(
      this.playerStage,
      this.selectedModule,
      hit.x,
      hit.z,
      this.ghostRot,
    );
    if (!next) {
      this.hud.showToast('Cannot place here');
      return;
    }
    this.playerStage = next;
    this.world.syncPlayerStage(this.playerStage);
    this.persist();
    this.hud.showToast(`Placed ${this.selectedModule}`);
  }

  private onSeqToggle(track: number, step: number): void {
    const seq = toggleStep(this.playerStage.sequencer, track, step);
    this.playerStage = { ...this.playerStage, sequencer: seq };
    this.audio.setPlayerSequencer(seq);
    this.hud.syncSequencer(seq);
    this.persist();
  }

  private onSeqPlay(): void {
    const seq = setPlaying(this.playerStage.sequencer, true);
    this.playerStage = { ...this.playerStage, sequencer: seq };
    this.audio.setPlayerSequencer(seq);
    this.hud.syncSequencer(seq);
    this.persist();
  }

  private onSeqStop(): void {
    const seq = setPlaying(this.playerStage.sequencer, false);
    this.playerStage = { ...this.playerStage, sequencer: seq };
    this.audio.setPlayerSequencer(seq);
    this.hud.syncSequencer(seq);
    this.persist();
  }

  private onSeqClear(): void {
    const seq = clearPattern(this.playerStage.sequencer);
    this.playerStage = { ...this.playerStage, sequencer: seq };
    this.audio.setPlayerSequencer(seq);
    this.hud.syncSequencer(seq);
    this.persist();
  }

  private onSeqTempo(bpm: number): void {
    const seq = setTempo(this.playerStage.sequencer, bpm);
    this.playerStage = { ...this.playerStage, sequencer: seq };
    this.audio.setPlayerSequencer(seq);
    this.persist();
  }

  private onLightApply(color: string, mode: 'static' | 'pulse' | 'beat'): void {
    if (!this.activeLightId) return;
    this.playerStage = updateModule(this.playerStage, this.activeLightId, {
      color,
      lightMode: mode,
    });
    this.world.syncPlayerStage(this.playerStage);
    this.persist();
    this.hud.showToast('Lights updated');
  }

  private isTyping(): boolean {
    const a = document.activeElement;
    if (!a) return false;
    const tag = a.tagName;
    return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
  }

  private onResize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  /** Snapshot used by headless browser checks. */
  getDebugState(): {
    playerX: number;
    playerZ: number;
    yaw: number;
    dayPhase: number;
    weather: string;
    running: boolean;
  } {
    return {
      playerX: this.player.position.x,
      playerZ: this.player.position.z,
      yaw: this.player.yaw,
      dayPhase: this.dayNight.phase,
      weather: this.weather.state.type,
      running: this.running,
    };
  }
}

function tSeconds(): number {
  return performance.now() * 0.001;
}
