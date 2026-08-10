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

```bash
npm run build
npm run preview
```

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

Pure logic tests cover herding, mission timer, base-path deploy helpers, collision, etc.

## Deploy (Vercel)

Static SPA: build outputs to `dist/`. Config lives in `vercel.json`.

```bash
npm run build
npx vercel --prod
```

Subdirectory build (e.g. peddavommond.de subpage):

```bash
# bash
VITE_BASE=/musicfestival/ npm run build

# PowerShell
$env:VITE_BASE="/musicfestival/"; npm run build
```

See **[docs/HANDOVER-peddavommond.de.md](docs/HANDOVER-peddavommond.de.md)** for the full peddavommond.de agent checklist (Vercel fields, path rewrites, domain options).

## Git remote

If `git remote -v` is empty after clone:

```bash
git remote add origin https://github.com/<owner>/musicfestival.git
git push -u origin main
```

## Stack

- Third-person guard controller + shepherd push physics
- Instanced raver “sheep” AI (wander, lag, wrong-way bolts)
- Five genre stages with procedural audio beds and lasers
- Fixed dusk lighting, dusty ground, stage zones
- Configurable Vite `base` via `VITE_BASE` for subpath hosting
