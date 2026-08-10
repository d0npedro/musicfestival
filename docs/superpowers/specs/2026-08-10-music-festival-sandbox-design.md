# Music Festival Sandbox — Design Spec

**Date:** 2026-08-10  
**Status:** Approved for implementation planning  
**Product:** Browser-based 3D open-world music festival sandbox (self-contained, single-player)

---

## 1. Goals & non-goals

### Goals

- Fully playable third-person sandbox in the browser with free movement across a compact procedural festival ground.
- Five genre stages (Psytrance, Tekk, Ghetto House, Hardstyle, Melodic DnB) with distinct visuals and procedural music.
- Day/night cycle and dynamic weather that change atmosphere and crowd behavior.
- Procedural instanced crowds that react to music intensity and player proximity/actions.
- Player can build/customize a small stage, control lights, trigger VFX, and run a 16-step beat sequencer.
- Persistent world state via `localStorage` (built stage, patterns, progress survive reloads).
- Calm exploration mixed with high-energy stage zones; smooth camera/controls; solid desktop performance.

### Non-goals (v1)

- Multiplayer / networking.
- Licensed or streamed audio tracks; sample-pack pipelines.
- Physics engine beyond simple collision (walls, stage bounds, ground).
- Mobile as a primary target (graceful degrade optional, not required).
- Complex RPG systems, inventory economy, or quest lines.

---

## 2. Stack & architecture

### Stack

| Layer | Choice |
|--------|--------|
| Tooling | Vite + TypeScript |
| 3D | Three.js (latest stable r16x) |
| Audio | Web Audio API (procedural genre synths) |
| UI | DOM/CSS overlay HUD (not R3F) |
| Persistence | `localStorage` JSON snapshot |
| Backend | None |

### Runtime systems

Single canvas + requestAnimationFrame game loop. Systems are modules with clear interfaces; the main loop ticks update then render.

```
Game
├── Input (keyboard/mouse/pointer lock optional for look)
├── Player (third-person character controller)
├── Camera (orbit / follow third-person)
├── World (terrain, props, stages, colliders)
├── DayNight (sun, sky, ambient)
├── Weather (clear / cloudy / rain / fog)
├── Crowd (instanced agents + behaviors)
├── AudioEngine (master bus, genre stages, player sequencer)
├── BuildMode (place/rotate/remove modules on player plot)
├── Interaction (E prompts, light/FX triggers)
├── Persistence (load/save/autosave)
└── UI (HUD, minimap, build palette, sequencer grid)
```

### Module boundaries

- **World** owns scene graph static/semi-static geometry and stage metadata; does not own audio clocks.
- **AudioEngine** owns all nodes and scheduling; exposes `getIntensity(stageId)`, `setPlayerPattern`, distance gains.
- **Crowd** reads intensity + weather + player position; writes only instance matrices/colors.
- **BuildMode** mutates player-stage layout in a pure data model; World applies meshes from that model.
- **Persistence** serializes only data models (not Three.js objects).

---

## 3. World & stages

### Layout (compact festival)

- Playable area roughly **200–300 m** across.
- **Ring of 5 genre stages** around a **central plaza**.
- **Player build plot** adjacent to plaza (clearly marked ground tiles).
- Dirt/grass paths connect plaza ↔ stages; decorative tents, trees, barriers, food stalls for density without empty sprawl.
- Stylized visual language: readable low-poly props + simple PBR materials (grass, dirt, metal truss, fabric).

### Genre stages

Each stage has: platform mesh, truss/roof, speaker stacks, unique **color palette**, light rig, signage, and an **AudioEngine** patch.

| Stage | Palette mood | Audio character (procedural) |
|--------|----------------|------------------------------|
| Psytrance | Magenta / cyan / UV | Rolling bass, 4-on-floor kick ~138–145 BPM, acid-ish lead |
| Tekk | Industrial grey / acid green | Hard kick, sparse hats, distorted stabs, dark atmosphere |
| Ghetto House | Warm orange / gold | Swung hats, vocal-chop-like synth stabs, groovy bass |
| Hardstyle | Red / white / black | Reverse bass feel, hard kick, screech-ish lead, high energy |
| Melodic DnB | Blue / teal / soft purple | Breakbeat drums ~170–174 BPM, atmospheric pads, melodic plucks |

Proximity: player hears nearest 1–2 stages with distance attenuation and crossfade.

### Movement & camera

- **Default third-person**: WASD move, mouse orbit/look, Shift sprint, Space optional jump (low height or disabled if it hurts feel).
- Character capsule vs simple AABB/sphere colliders for stage blocks, barriers, world bounds.
- Smooth springy camera follow with collision pull-in if obstructed (simple ray).

---

## 4. Audio engine & sequencer

### Master graph

```
GenreStageSynths[5] ──┐
PlayerSequencer ──────┼──► MasterGain ──► Compressor ──► Destination
Ambient (wind/crowd) ─┘         └──► Convolver/Reverb send (shared)
```

- User gesture required to start audio (click “Enter Festival”).
- Global master volume in HUD.
- Intensity per stage ∈ [0, 1]: derived from mix level + sequencer density + time-of-day boost at night.

### Genre synths

Lightweight schedulers on `AudioContext.currentTime`: kick, bass, hats, optional lead/FX. Parameters differ per genre (tempo, swing, filter cutoff envelope, distortion amount). No external samples required.

### Player sequencer

- **16 steps**, **4 tracks**: Kick, Snare, Hat, Bass.
- Tempo control (e.g. 100–150 BPM, default 128).
- Click cells to toggle; Play/Stop; clear pattern.
- Pattern + tempo saved with world state.
- When playing, drives player-stage lights (beat pulse) and nearby crowd intensity.

---

## 5. Crowds, day/night, weather

### Crowds

- **InstancedMesh** crowd (target hundreds of instances desktop).
- States: wander (paths/plaza), attracted-to-stage, dance (bob/spin scaled by intensity), shelter (slight bias under tents/canopies in rain).
- Near player: subtle avoidance so the world feels occupied, not solid.
- Simple color variance + optional emissive tint near stages at night.

### Day/night

- Full cycle ~**8–12 minutes** real time (configurable constant).
- Sun directional light + hemisphere/ambient; sky color lerp (or simple shader/gradient dome).
- Night: stronger stage spot/point lights, higher fog glow, music intensity bias upward.

### Weather

States: **clear**, **cloudy**, **rain**, **fog**. Transitions over tens of seconds.

| Weather | Visual | Crowd |
|---------|--------|--------|
| Clear | High sun, low fog | Normal distribution |
| Cloudy | Soft ambient, grey sky | Slightly slower wander |
| Rain | Particles, darker, wetter materials optional | Bias to shelters, still dance hard near loud stages |
| Fog | Dense fog, reduced view distance | Stages “appear” with lights; more intimate |

Weather seed/state persisted so reload continues coherently.

---

## 6. Build mode, lights & FX

### Build plot

- Grid-snapped placement on dedicated plot bounds.
- Modules: **deck**, **speakers**, **light pole**, **LED wall**, **dancefloor tile**.
- Place / rotate (R) / remove (right-click or X) with ghost preview and in-bounds validation.
- Max module counts to protect performance (e.g. ≤ 40 modules).

### Interaction

- **E** on interactables: open sequencer (deck), light panel (poles/LED), trigger FX (stage FX pad).
- Light modes: static, pulse, beat-sync (uses AudioEngine beat clock / intensity).
- FX bursts: strobe flash, laser sweep (line/beam meshes), particle confetti/sparks (short-lived).

### Data model (persistable)

```ts
type PlayerStageState = {
  modules: Array<{
    id: string;
    type: 'deck' | 'speakers' | 'lightPole' | 'ledWall' | 'dancefloor';
    x: number; z: number; rotY: number;
    color?: string;
    lightMode?: 'static' | 'pulse' | 'beat';
  }>;
  sequencer: {
    tempo: number;
    tracks: boolean[][]; // 4 x 16
    playing: boolean;
  };
};
```

---

## 7. Persistence, HUD, performance

### Persistence

`localStorage` key e.g. `musicfestival-save-v1`:

- Player position + facing
- Day time (0–1 cycle)
- Weather type + transition progress
- Player stage layout + sequencer patterns
- Optional: visited stages flag / soft “progress” (first visit unlocks nothing critical — exploratory, not gatey)

Autosave every ~15–30s + on meaningful actions (place module, stop sequencer) + `beforeunload`.

### HUD

- Crosshair-free exploration; soft **interact prompt** when near interactable.
- **Minimap**: plaza, 5 stages, player plot, player arrow.
- Time-of-day icon + weather icon.
- Nearest stage name / genre.
- Build palette panel (toggle B).
- Sequencer panel (when at deck).
- Controls help (toggle H or first-run overlay).
- Volume + Enter Festival gate.

### Performance targets

- **60 fps** on mid-range desktop Chrome.
- Instancing for crowds; shared materials; limit simultaneous dynamic lights (bake/fake where possible).
- Cull far props; only 1–2 full audio stages active.
- Particle counts capped; rain as screen-aligned or simple streak system.
- No shadows on every object: selective shadow casters (player + main stage trusses) if budget allows; else blob/fake shadow.

---

## 8. Player journey (first session)

1. Title overlay → click **Enter Festival** (unlocks audio + pointer).
2. Spawn at plaza sunset or golden hour; soft ambient + distant stage thumps.
3. Follow paths / minimap to stages; crowds denser near loud stages.
4. Discover player plot; enter build mode; place deck + speakers + lights.
5. Open sequencer; layer a pattern; watch lights and nearby crowd respond.
6. Night falls; weather may shift to rain/fog; atmosphere peaks.
7. Reload page → same stage layout, pattern, approximate time/weather.

---

## 9. File layout (implementation)

```
/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── docs/superpowers/specs/...
└── src/
    ├── main.ts
    ├── styles.css
    ├── game/Game.ts
    ├── systems/
    │   ├── Input.ts
    │   ├── Player.ts
    │   ├── CameraFollow.ts
    │   ├── World.ts
    │   ├── DayNight.ts
    │   ├── Weather.ts
    │   ├── Crowd.ts
    │   ├── AudioEngine.ts
    │   ├── genres/*.ts
    │   ├── BuildMode.ts
    │   ├── Interaction.ts
    │   └── Persistence.ts
    ├── ui/
    │   ├── hud.ts
    │   ├── minimap.ts
    │   ├── sequencer.ts
    │   └── buildPalette.ts
    └── utils/
        ├── math.ts
        └── prng.ts
```

---

## 10. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Audio context blocked | Explicit Enter Festival gesture; muted until then |
| Crowd FPS cost | Instancing, simple animation, distance LOD (skip dance far away) |
| Web Audio CPU | Shared schedules, one clock, deactivate far stages |
| Empty-feeling world | Compact layout, props density, ambient audio, crowd attractors |
| Save corruption | Versioned schema; migrate or reset with notice |

---

## 11. Success criteria

- Player can walk the full grounds with smooth third-person control.
- Each of 5 genres is audibly and visually distinct.
- Day/night and at least two weather states visibly change the scene.
- Crowds visibly dance harder when music intensity rises.
- Player builds a stage, sequences a beat, triggers lights/FX.
- Reload restores built stage and sequencer pattern.
- Feels like a complete mini-festival experience without external assets.

---

## Decisions log

- Camera: third-person default  
- Audio: procedural Web Audio only  
- Scale: compact festival  
- Stack: Vite + TypeScript + Three.js pure  
- Persistence: localStorage  
- Sequencer: 16-step × 4 tracks  
- Crowds: dense instanced agents  
- Build: modular grid placement on player plot  
