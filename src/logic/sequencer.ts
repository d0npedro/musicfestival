import {
  SEQUENCER_STEPS,
  SEQUENCER_TRACKS,
  TEMPO_DEFAULT,
  TEMPO_MAX,
  TEMPO_MIN,
} from './constants';

export type SequencerState = {
  tempo: number;
  tracks: boolean[][];
  playing: boolean;
};

/** Create empty 4×16 pattern. */
export function createEmptySequencer(tempo = TEMPO_DEFAULT): SequencerState {
  return {
    tempo: clampTempo(tempo),
    tracks: Array.from({ length: SEQUENCER_TRACKS }, () =>
      Array.from({ length: SEQUENCER_STEPS }, () => false),
    ),
    playing: false,
  };
}

export function clampTempo(bpm: number): number {
  if (!Number.isFinite(bpm)) return TEMPO_DEFAULT;
  return Math.min(TEMPO_MAX, Math.max(TEMPO_MIN, Math.round(bpm)));
}

export function setTempo(state: SequencerState, bpm: number): SequencerState {
  return { ...state, tempo: clampTempo(bpm) };
}

export function toggleStep(
  state: SequencerState,
  track: number,
  step: number,
): SequencerState {
  if (track < 0 || track >= SEQUENCER_TRACKS) return state;
  if (step < 0 || step >= SEQUENCER_STEPS) return state;
  const tracks = state.tracks.map((row, ti) =>
    row.map((cell, si) => {
      if (ti === track && si === step) return !cell;
      return cell;
    }),
  );
  return { ...state, tracks };
}

export function setPlaying(state: SequencerState, playing: boolean): SequencerState {
  return { ...state, playing };
}

export function clearPattern(state: SequencerState): SequencerState {
  return {
    ...state,
    tracks: Array.from({ length: SEQUENCER_TRACKS }, () =>
      Array.from({ length: SEQUENCER_STEPS }, () => false),
    ),
  };
}

/** Density 0–1 based on active cells (drives intensity). */
export function patternDensity(state: SequencerState): number {
  let on = 0;
  const total = SEQUENCER_TRACKS * SEQUENCER_STEPS;
  for (const row of state.tracks) {
    for (const cell of row) if (cell) on++;
  }
  return on / total;
}

/**
 * Intensity contribution from player sequencer while playing.
 * Playing with empty pattern still yields a small idle thump.
 */
export function sequencerIntensity(state: SequencerState): number {
  if (!state.playing) return 0;
  const d = patternDensity(state);
  return Math.min(1, 0.25 + d * 1.5);
}

export function cloneSequencer(state: SequencerState): SequencerState {
  return {
    tempo: state.tempo,
    playing: state.playing,
    tracks: state.tracks.map((r) => [...r]),
  };
}
