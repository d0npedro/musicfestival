import { describe, expect, it } from 'vitest';
import {
  defaultSave,
  normalizeSave,
  parseSave,
  serializeSave,
} from './persistence';
import { toggleStep, setPlaying, setTempo } from './sequencer';
import { placeModule } from './buildGrid';
import { PLOT_CENTER } from './constants';

describe('persistence', () => {
  it('round-trips stage modules, sequencer, position, day, weather', () => {
    const save = defaultSave();
    save.player = { x: 12.5, y: 0, z: -3.2, yaw: 1.1 };
    save.dayPhase = 0.72;
    save.weather = { type: 'rain', blend: 0.8, nextChangeIn: 22 };
    save.visitedStages = ['psytrance', 'hardstyle'];

    let stage = save.playerStage;
    const placed = placeModule(stage, 'deck', PLOT_CENTER.x, PLOT_CENTER.z, 0, 'deck1');
    expect(placed).not.toBeNull();
    stage = placed!;
    stage = placeModule(stage, 'speakers', PLOT_CENTER.x + 2, PLOT_CENTER.z, Math.PI / 2, 'sp1')!;
    let seq = stage.sequencer;
    seq = toggleStep(seq, 0, 0);
    seq = toggleStep(seq, 2, 4);
    seq = setTempo(seq, 140);
    seq = setPlaying(seq, true);
    stage = { ...stage, sequencer: seq };
    save.playerStage = stage;

    const raw = serializeSave(save);
    const restored = parseSave(raw);
    expect(restored).not.toBeNull();
    expect(restored!.player.x).toBeCloseTo(12.5);
    expect(restored!.player.z).toBeCloseTo(-3.2);
    expect(restored!.dayPhase).toBeCloseTo(0.72);
    expect(restored!.weather.type).toBe('rain');
    expect(restored!.weather.blend).toBeCloseTo(0.8);
    expect(restored!.playerStage.modules).toHaveLength(2);
    expect(restored!.playerStage.modules[0]!.type).toBe('deck');
    expect(restored!.playerStage.sequencer.tempo).toBe(140);
    expect(restored!.playerStage.sequencer.playing).toBe(true);
    expect(restored!.playerStage.sequencer.tracks[0]![0]).toBe(true);
    expect(restored!.playerStage.sequencer.tracks[2]![4]).toBe(true);
    expect(restored!.visitedStages).toEqual(['psytrance', 'hardstyle']);
  });

  it('rejects garbage and normalizes partial data', () => {
    expect(parseSave('not-json')).toBeNull();
    expect(normalizeSave(null)).toBeNull();
    const partial = normalizeSave({ version: 1, dayPhase: 2.25, weather: { type: 'fog' } });
    expect(partial).not.toBeNull();
    expect(partial!.dayPhase).toBeCloseTo(0.25);
    expect(partial!.weather.type).toBe('fog');
    expect(partial!.playerStage.modules).toEqual([]);
  });
});
