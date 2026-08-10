# Handover: peddavommond.de agent — deploy **Herd the Ravers** as a subpage

This document is for the **peddavommond.de** owner/agent. It assumes you can push to GitHub and configure Vercel (or attach an existing Vercel project to this repo).

## What this project is

- **Name:** Herd the Ravers (package `musicfestival`)
- **Stack:** Vite + TypeScript + Three.js static SPA (`dist/`)
- **Repo root = app root** (no monorepo subdirectory for the game itself)
- **Default production base:** `/` (standalone Vercel URL)
- **Subpage base:** set `VITE_BASE=/musicfestival/` (or another path) at build time

## Clone / install / build

```bash
git clone <THIS_REPO_URL>
cd musicfestival
npm install
npm test
npm run build          # root base → dist/
```

Subpage-ready build (assets prefixed):

```bash
# Windows PowerShell
$env:VITE_BASE="/musicfestival/"; npm run build

# bash
VITE_BASE=/musicfestival/ npm run build
```

After a subpath build, `dist/index.html` asset URLs must start with `/musicfestival/` (verify before shipping).

## Vercel project settings (standalone project)

| Field | Value |
|--------|--------|
| **Framework Preset** | Vite (auto) |
| **Root Directory** | `.` (repo root) |
| **Install Command** | `npm install` |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Node** | 20.x or 22.x recommended |

SPA fallback is already in repo `vercel.json` (rewrites unknown paths → `index.html`; static assets under `/assets/` still served normally).

### Environment variables (Vercel → Project → Settings → Environment Variables)

| Name | Production (apex / `*.vercel.app`) | Production (subpath on peddavommond.de) |
|------|-------------------------------------|----------------------------------------|
| `VITE_BASE` | `/` or omit | `/musicfestival/` (must match public URL path) |

Redeploy after changing `VITE_BASE`.

### CLI deploy (from repo root)

```bash
npx vercel link          # once
npx vercel --prod
```

## Mount under **peddavommond.de** subpage

Intended public URL pattern:

```text
https://peddavommond.de/musicfestival/
```

(Trailing slash preferred; `VITE_BASE` must be `/musicfestival/`.)

### Option A — Separate Vercel project + path rewrite on the main site (recommended)

1. Deploy **this** repo as its own Vercel project (e.g. `herd-the-ravers` → `herd-the-ravers.vercel.app`).
2. Set project env `VITE_BASE=/musicfestival/` and redeploy.
3. On the **peddavommond.de** Vercel project (main site), add rewrites so the subpath proxies to this deployment:

```json
{
  "rewrites": [
    {
      "source": "/musicfestival",
      "destination": "https://herd-the-ravers.vercel.app/musicfestival"
    },
    {
      "source": "/musicfestival/:path*",
      "destination": "https://herd-the-ravers.vercel.app/musicfestival/:path*"
    }
  ]
}
```

Adjust the destination hostname to the real production deployment host after first deploy.

**Important:** With external rewrites, the **browser still requests** `/musicfestival/assets/...` on `peddavommond.de`. Those must either:

- be rewritten to the game project as above (covers assets under `/musicfestival/*`), **or**
- the game project must be attached as the only app on a dedicated subdomain (Option B).

### Option B — Subdomain

```text
https://festival.peddavommond.de/
```

- Set `VITE_BASE=/`
- Add the subdomain as a domain on this Vercel project
- No path rewrites needed

### Option C — Monorepo / single project output

If peddavommond.de builds multiple sites from one repo:

1. Place this app under e.g. `apps/musicfestival/`
2. Set Vercel **Root Directory** to `apps/musicfestival`
3. Set `VITE_BASE=/musicfestival/`
4. Ensure the parent site does not serve a conflicting `/musicfestival` route

## Agent checklist (copy/paste)

- [ ] Repo cloned; `npm install` + `npm test` + `npm run build` succeed
- [ ] Git remote is the canonical GitHub repo; `main` is deploy branch
- [ ] Vercel project linked to that repo (or CLI `--prod` works)
- [ ] Decide **subpath** `/musicfestival/` vs **subdomain**
- [ ] Set `VITE_BASE` to match the public path (`/` or `/musicfestival/`)
- [ ] Production deploy green; open URL and confirm **Start Shift** shell + canvas
- [ ] If subpath: main site rewrites for `/musicfestival` and `/musicfestival/:path*` point at this project
- [ ] Smoke: hard-refresh; no 404 on `/musicfestival/assets/*` JS/CSS
- [ ] Optional: disable Vercel Deployment Protection on production if the public must play without login

## What not to change for deploy

- Core game logic under `src/game`, `src/systems`, `src/logic` (except if base-path breaks absolute asset URLs — there should be none; Vite injects `import.meta.env.BASE_URL`)
- Do not commit `.env`, `.vercel/`, or `node_modules`

## Related files in this repo

| Path | Role |
|------|------|
| `vercel.json` | Build/output + SPA rewrite + asset cache headers |
| `vite.config.ts` | Reads `VITE_BASE` / `BASE_PATH` via `src/deploy/basePath.ts` |
| `.env.example` | Documents `VITE_BASE` |
| `src/deploy/basePath.ts` | Shipped normalizer used by Vite config (unit-tested) |
| `README.md` | Player-facing run instructions + deploy pointer |

## Ownership

After you attach the GitHub remote and Vercel project to the peddavommond.de team/account, this handover is complete: redeploys are Git push → Vercel, or CLI, with `VITE_BASE` as the only subpage-specific knob.
