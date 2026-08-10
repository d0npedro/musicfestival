/** Festival world half-extent (compact ~240m diameter playable). */
export const WORLD_HALF = 120;
export const WORLD_BOUNDS = {
  minX: -WORLD_HALF,
  maxX: WORLD_HALF,
  minZ: -WORLD_HALF,
  maxZ: WORLD_HALF,
} as const;

export const PLAYER_RADIUS = 0.45;
export const PLAYER_WALK_SPEED = 8;
export const PLAYER_SPRINT_SPEED = 14;
export const PLAYER_HEIGHT = 1.7;

export const SAVE_KEY = 'musicfestival-save-v1';
export const SAVE_VERSION = 1;

export const SEQUENCER_TRACKS = 4;
export const SEQUENCER_STEPS = 16;
export const SEQUENCER_TRACK_NAMES = ['Kick', 'Snare', 'Hat', 'Bass'] as const;
export const TEMPO_MIN = 100;
export const TEMPO_MAX = 150;
export const TEMPO_DEFAULT = 128;

export const BUILD_MAX_MODULES = 40;
export const BUILD_GRID = 2;
export const PLOT_HALF = 10;
export const PLOT_CENTER = { x: 18, z: 18 } as const;

export const MODULE_TYPES = [
  'deck',
  'speakers',
  'lightPole',
  'ledWall',
  'dancefloor',
] as const;
export type ModuleType = (typeof MODULE_TYPES)[number];

export const GENRE_STAGES = [
  {
    id: 'psytrance',
    name: 'Psytrance',
    x: 0,
    z: -70,
    color: 0xff00cc,
    secondary: 0x00ffff,
    bpm: 142,
  },
  {
    id: 'tekk',
    name: 'Tekk',
    x: 66,
    z: -22,
    color: 0x66ff33,
    secondary: 0x333333,
    bpm: 150,
  },
  {
    id: 'ghettohouse',
    name: 'Ghetto House',
    x: 48,
    z: 52,
    color: 0xff8800,
    secondary: 0xffd700,
    bpm: 128,
  },
  {
    id: 'hardstyle',
    name: 'Hardstyle',
    x: -48,
    z: 52,
    color: 0xff1133,
    secondary: 0xffffff,
    bpm: 150,
  },
  {
    id: 'melodicdnb',
    name: 'Melodic DnB',
    x: -66,
    z: -22,
    color: 0x3388ff,
    secondary: 0xaa66ff,
    bpm: 172,
  },
] as const;

export type GenreStageId = (typeof GENRE_STAGES)[number]['id'];

export const WEATHER_TYPES = ['clear', 'cloudy', 'rain', 'fog'] as const;
export type WeatherType = (typeof WEATHER_TYPES)[number];

/** Full day cycle length in seconds (~10 min). */
export const DAY_LENGTH_SEC = 600;

export const CROWD_COUNT = 280;
