# Neon Grounds — Music Festival Sandbox

Browser 3D open-world music festival sandbox built with **Vite**, **TypeScript**, **Three.js**, and the **Web Audio API**.

## Run

```bash
npm install
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173`).

**Do not open `index.html` via `file://`** — ES modules require a local server.

Production build:

```bash
npm run build
npm run preview
```

## Tests

```bash
npm test
```

Unit tests cover sequencer logic, persistence round-trips, day/night phase, weather transitions, crowd intensity mapping, collision/bounds, and build-grid placement (shipped modules under `src/logic/`).

## Controls

| Key | Action |
|-----|--------|
| WASD | Move |
| Mouse drag | Orbit camera |
| Shift | Sprint |
| E | Interact (deck sequencer / lights) |
| B | Build mode |
| 1–5 | Select module |
| R | Rotate module |
| X | Remove nearest module |
| F | Stage FX (lasers / strobe) |
| H | Help |
| P | Manual save |

## Features

- Compact festival grounds with five genre stages: Psytrance, Tekk, Ghetto House, Hardstyle, Melodic DnB
- Procedural Web Audio per genre + player 16-step × 4-track sequencer
- Day/night cycle and weather (clear, cloudy, rain, fog)
- Instanced crowds reacting to music intensity and rain shelter bias
- Build your stage (deck, speakers, lights, LED wall, dancefloor)
- `localStorage` persistence (`musicfestival-save-v1`)
