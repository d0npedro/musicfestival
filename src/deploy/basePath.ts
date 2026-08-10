/**
 * Normalize Vite `base` for root or subdirectory deploys
 * (e.g. peddavommond.de/musicfestival/).
 *
 * Rules:
 * - empty / missing → `/`
 * - always starts with `/`
 * - always ends with `/` (except bare `/` which already does)
 * - collapses duplicate slashes
 */
export function normalizeBasePath(raw: string | undefined | null): string {
  if (raw == null || String(raw).trim() === '') return '/';
  let b = String(raw).trim();
  // Allow "musicfestival" or "musicfestival/" or "/musicfestival"
  if (!b.startsWith('/')) b = `/${b}`;
  if (!b.endsWith('/')) b = `${b}/`;
  // Collapse // (but keep leading single /)
  b = b.replace(/\/{2,}/g, '/');
  return b === '' ? '/' : b;
}

/**
 * Resolve base from env-style map (pass `process.env` from Node/Vite config).
 * Prefer VITE_BASE, then BASE_PATH, default `/`.
 */
export function resolveBaseFromEnv(
  env: Record<string, string | undefined> = {},
): string {
  return normalizeBasePath(env.VITE_BASE ?? env.BASE_PATH ?? '/');
}
