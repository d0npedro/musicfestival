import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  basePathSegment,
  mapSubpathRequestToDist,
  normalizeBasePath,
  parentProxyRewrites,
  resolveBaseFromEnv,
  vercelRewritesForBase,
} from './basePath';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('normalizeBasePath', () => {
  it('defaults empty to root slash', () => {
    expect(normalizeBasePath(undefined)).toBe('/');
    expect(normalizeBasePath(null)).toBe('/');
    expect(normalizeBasePath('')).toBe('/');
    expect(normalizeBasePath('   ')).toBe('/');
  });

  it('ensures leading and trailing slashes for subpaths', () => {
    expect(normalizeBasePath('musicfestival')).toBe('/musicfestival/');
    expect(normalizeBasePath('/musicfestival')).toBe('/musicfestival/');
    expect(normalizeBasePath('/musicfestival/')).toBe('/musicfestival/');
    expect(normalizeBasePath('musicfestival/')).toBe('/musicfestival/');
  });

  it('keeps root as single slash', () => {
    expect(normalizeBasePath('/')).toBe('/');
  });

  it('collapses duplicate slashes', () => {
    expect(normalizeBasePath('//musicfestival//')).toBe('/musicfestival/');
  });
});

describe('resolveBaseFromEnv', () => {
  it('reads VITE_BASE then BASE_PATH', () => {
    expect(resolveBaseFromEnv({ VITE_BASE: '/musicfestival' })).toBe('/musicfestival/');
    expect(resolveBaseFromEnv({ BASE_PATH: 'herd' })).toBe('/herd/');
    expect(resolveBaseFromEnv({ VITE_BASE: '/a/', BASE_PATH: '/b/' })).toBe('/a/');
    expect(resolveBaseFromEnv({})).toBe('/');
  });
});

describe('mapSubpathRequestToDist (asset strip)', () => {
  const base = '/musicfestival/';

  it('maps subpath JS/CSS URLs onto dist /assets/* (not index.html)', () => {
    expect(mapSubpathRequestToDist('/musicfestival/assets/index-abc.js', base)).toBe(
      '/assets/index-abc.js',
    );
    expect(mapSubpathRequestToDist('/musicfestival/assets/index-abc.css', base)).toBe(
      '/assets/index-abc.css',
    );
  });

  it('maps subpath shell to index.html', () => {
    expect(mapSubpathRequestToDist('/musicfestival', base)).toBe('/index.html');
    expect(mapSubpathRequestToDist('/musicfestival/', base)).toBe('/index.html');
    expect(mapSubpathRequestToDist('/musicfestival/foo', base)).toBe('/index.html');
  });

  it('does not treat real asset paths as SPA when already stripped', () => {
    expect(mapSubpathRequestToDist('/assets/index-abc.js', base)).toBe(
      '/assets/index-abc.js',
    );
  });
});

describe('vercelRewritesForBase', () => {
  it('puts asset strip before SPA catch-all for musicfestival', () => {
    const rules = vercelRewritesForBase('/musicfestival/');
    const assetIdx = rules.findIndex((r) => r.source.includes('/assets/'));
    const spaIdx = rules.findIndex(
      (r) => r.source === '/musicfestival/:path*' && r.destination === '/index.html',
    );
    expect(assetIdx).toBeGreaterThanOrEqual(0);
    expect(spaIdx).toBeGreaterThan(assetIdx);
    expect(rules[assetIdx]!.destination).toBe('/assets/:path*');
  });

  it('shipped vercel.json matches helper for /musicfestival/', () => {
    const raw = readFileSync(join(root, 'vercel.json'), 'utf8');
    const json = JSON.parse(raw) as {
      rewrites: { source: string; destination: string }[];
    };
    const expected = vercelRewritesForBase('/musicfestival/');
    expect(json.rewrites).toEqual(expected);
  });
});

describe('parentProxyRewrites', () => {
  it('keeps base prefix on the game origin (game project strips)', () => {
    const rules = parentProxyRewrites(
      '/musicfestival/',
      'https://musicfestival-nine.vercel.app',
    );
    expect(rules.find((r) => r.source === '/musicfestival/:path*')!.destination).toBe(
      'https://musicfestival-nine.vercel.app/musicfestival/:path*',
    );
    expect(rules.find((r) => r.source === '/musicfestival')!.destination).toBe(
      'https://musicfestival-nine.vercel.app/musicfestival',
    );
  });
});

describe('basePathSegment', () => {
  it('extracts first segment', () => {
    expect(basePathSegment('/musicfestival/')).toBe('musicfestival');
    expect(basePathSegment('/')).toBeNull();
  });
});
