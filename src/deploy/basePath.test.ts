import { describe, expect, it } from 'vitest';
import { normalizeBasePath, resolveBaseFromEnv } from './basePath';

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
