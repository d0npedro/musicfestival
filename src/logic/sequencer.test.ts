import { describe, expect, it } from 'vitest';
import {
  clearPattern,
  createEmptySequencer,
  patternDensity,
  sequencerIntensity,
  setPlaying,
  setTempo,
  toggleStep,
} from './sequencer';
import { SEQUENCER_STEPS, SEQUENCER_TRACKS, TEMPO_MAX, TEMPO_MIN } from './constants';

describe('sequencer', () => {
  it('creates 4×16 empty grid at default tempo', () => {
    const s = createEmptySequencer();
    expect(s.tracks).toHaveLength(SEQUENCER_TRACKS);
    expect(s.tracks.every((r) => r.length === SEQUENCER_STEPS)).toBe(true);
    expect(s.tracks.flat().every((c) => c === false)).toBe(true);
    expect(s.playing).toBe(false);
  });

  it('toggles steps and clamps tempo', () => {
    let s = createEmptySequencer();
    s = toggleStep(s, 0, 0);
    expect(s.tracks[0]![0]).toBe(true);
    s = toggleStep(s, 0, 0);
    expect(s.tracks[0]![0]).toBe(false);
    s = toggleStep(s, -1, 0);
    expect(s.tracks[0]![0]).toBe(false);
    s = setTempo(s, 999);
    expect(s.tempo).toBe(TEMPO_MAX);
    s = setTempo(s, 10);
    expect(s.tempo).toBe(TEMPO_MIN);
  });

  it('computes density and intensity only while playing', () => {
    let s = createEmptySequencer();
    for (let i = 0; i < 8; i++) s = toggleStep(s, 0, i);
    expect(patternDensity(s)).toBeCloseTo(8 / (SEQUENCER_TRACKS * SEQUENCER_STEPS));
    expect(sequencerIntensity(s)).toBe(0);
    s = setPlaying(s, true);
    expect(sequencerIntensity(s)).toBeGreaterThan(0.25);
    s = clearPattern(s);
    expect(patternDensity(s)).toBe(0);
    expect(sequencerIntensity(s)).toBeCloseTo(0.25);
  });
});
