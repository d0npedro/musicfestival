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

/** Path segment without slashes, e.g. `musicfestival` from `/musicfestival/`. */
export function basePathSegment(base: string): string | null {
  const n = normalizeBasePath(base);
  if (n === '/') return null;
  return n.replace(/^\/+|\/+$/g, '').split('/')[0] ?? null;
}

export type VercelRewrite = { source: string; destination: string };

/**
 * Vercel rewrites for a Vite SPA where `base` is a subdirectory.
 *
 * Vite still emits files under `/assets/*` and `/index.html` on disk, but HTML
 * references `/<base>/assets/*`. Without strip rewrites, SPA catch-alls serve
 * `text/html` for JS URLs.
 *
 * Order matters: static under base first, then SPA fallbacks, then root SPA.
 */
export function vercelRewritesForBase(base: string): VercelRewrite[] {
  const seg = basePathSegment(base);
  const rewrites: VercelRewrite[] = [];

  if (seg) {
    const p = `/${seg}`;
    // Map public URL prefix back onto dist root layout
    rewrites.push(
      { source: `${p}/assets/:path*`, destination: '/assets/:path*' },
      { source: `${p}/favicon.svg`, destination: '/favicon.svg' },
      { source: `${p}/icons.svg`, destination: '/icons.svg' },
      { source: p, destination: '/index.html' },
      { source: `${p}/`, destination: '/index.html' },
      // Non-file SPA routes under the subpath
      { source: `${p}/:path*`, destination: '/index.html' },
    );
  }

  // Root SPA fallback — must not swallow real /assets/* files (Vercel serves
  // existing files before rewrites; this only hits missing paths).
  rewrites.push({
    source: '/((?!assets/).*)',
    destination: '/index.html',
  });

  return rewrites;
}

/**
 * Parent-site (peddavommond.de) rewrites that proxy a subpath to this game
 * deployment **keeping the base prefix**, so the game project can strip it.
 */
export function parentProxyRewrites(
  subpath: string,
  gameOrigin: string,
): VercelRewrite[] {
  const seg = basePathSegment(subpath) ?? 'musicfestival';
  const origin = gameOrigin.replace(/\/+$/, '');
  const p = `/${seg}`;
  return [
    { source: p, destination: `${origin}${p}` },
    { source: `${p}/`, destination: `${origin}${p}/` },
    { source: `${p}/:path*`, destination: `${origin}${p}/:path*` },
  ];
}

/**
 * Whether a request path under `base` should map to a static dist file path
 * (not the SPA shell). Used by tests and docs; mirrors vercel rewrite intent.
 */
export function mapSubpathRequestToDist(
  requestPath: string,
  base: string,
): string {
  const seg = basePathSegment(base);
  if (!seg) return requestPath.startsWith('/') ? requestPath : `/${requestPath}`;
  const prefix = `/${seg}`;
  const path = requestPath.startsWith('/') ? requestPath : `/${requestPath}`;

  if (path === prefix || path === `${prefix}/`) return '/index.html';
  if (path.startsWith(`${prefix}/assets/`)) {
    return path.slice(prefix.length); // → /assets/...
  }
  if (
    path === `${prefix}/favicon.svg` ||
    path === `${prefix}/icons.svg`
  ) {
    return path.slice(prefix.length);
  }
  if (path.startsWith(`${prefix}/`)) return '/index.html';
  return path;
}
