# Herd the Ravers — Festival Security

Chaotic comedy herding game: you are the **only security guard** left at a huge outdoor electronic festival at **dusk**. Hundreds of slightly drunk ravers scatter like stubborn sheep. Drive them to the main stages before the headliner — you have **5 minutes**.

Built with **Vite**, **TypeScript**, **Three.js**, and procedural **Web Audio**.

## Run

```bash
npm install
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173`).  
Do not open via `file://`.

## Goal

- Herd **~72%** of ravers into the glowing **stage zones** (minimap circles)
- Beat the **5:00** countdown
- No dogs. No colleagues. Just you, a radio, and a high-vis vest

## Controls

| Input | Action |
|--------|--------|
| WASD | Jog (shepherd shuffle) |
| Mouse drag | Orbit camera (low cinematic angle) |
| Shift | Sprint |
| **Hold Space** | Arms wide — push the flock |
| E / F | Radio shout (wider scare) |
| H | Help |

## Tests

```bash
npm test
```

Pure logic tests cover herding forces, stage zones, mission timer win/lose, plus prior collision/sequencer helpers.

## Stack

- Third-person guard controller + shepherd push physics
- Instanced raver “sheep” AI (wander, lag, wrong-way bolts)
- Five genre stages with procedural audio beds and lasers
- Fixed dusk lighting, dusty ground, stage zones
