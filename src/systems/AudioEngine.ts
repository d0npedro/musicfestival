import { GENRE_STAGES, PLOT_CENTER, type GenreStageId } from '../logic/constants';
import {
  computeStageGains,
  playerStageGain,
  stageIntensity,
} from '../logic/audioMix';
import type { SequencerState } from '../logic/sequencer';
import { cloneSequencer, createEmptySequencer } from '../logic/sequencer';

type Voice = {
  gain: GainNode;
  timer: number | null;
  step: number;
};

/**
 * Procedural Web Audio festival engine.
 * Five genre patches + player 16-step sequencer.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private reverbGain: GainNode | null = null;
  private started = false;
  private masterVolume = 0.7;
  private dayPhase = 0.35;
  private playerX = 0;
  private playerZ = 0;
  private stageVoices = new Map<GenreStageId, Voice>();
  private playerVoice: Voice | null = null;
  private playerSeq: SequencerState = createEmptySequencer();
  private ambient: OscillatorNode | null = null;
  private ambientGain: GainNode | null = null;

  get isStarted(): boolean {
    return this.started;
  }

  async start(): Promise<void> {
    if (this.started) return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    await this.ctx.resume();

    this.master = this.ctx.createGain();
    this.master.gain.value = this.masterVolume;
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.knee.value = 12;
    this.compressor.ratio.value = 4;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.15;
    this.reverbGain = this.ctx.createGain();
    this.reverbGain.gain.value = 0.18;

    this.master.connect(this.compressor);
    this.compressor.connect(this.ctx.destination);
    this.reverbGain.connect(this.master);

    for (const s of GENRE_STAGES) {
      const g = this.ctx.createGain();
      g.gain.value = 0;
      g.connect(this.master);
      g.connect(this.reverbGain);
      this.stageVoices.set(s.id, { gain: g, timer: null, step: 0 });
    }

    const pg = this.ctx.createGain();
    pg.gain.value = 0;
    pg.connect(this.master);
    this.playerVoice = { gain: pg, timer: null, step: 0 };

    // Soft ambient pad
    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0.02;
    this.ambientGain.connect(this.master);
    this.ambient = this.ctx.createOscillator();
    this.ambient.type = 'sine';
    this.ambient.frequency.value = 55;
    const ambLfo = this.ctx.createOscillator();
    ambLfo.frequency.value = 0.08;
    const ambLfoG = this.ctx.createGain();
    ambLfoG.gain.value = 8;
    ambLfo.connect(ambLfoG);
    ambLfoG.connect(this.ambient.frequency);
    this.ambient.connect(this.ambientGain);
    this.ambient.start();
    ambLfo.start();

    this.started = true;
    this.rescheduleAll();
  }

  setMasterVolume(v: number): void {
    this.masterVolume = Math.min(1, Math.max(0, v));
    if (this.master) this.master.gain.setTargetAtTime(this.masterVolume, this.now(), 0.05);
  }

  setDayPhase(phase: number): void {
    this.dayPhase = phase;
  }

  setPlayerPosition(x: number, z: number): void {
    this.playerX = x;
    this.playerZ = z;
  }

  setPlayerSequencer(seq: SequencerState): void {
    const wasPlaying = this.playerSeq.playing;
    this.playerSeq = cloneSequencer(seq);
    if (!this.started || !this.playerVoice || !this.ctx) return;
    if (seq.playing && !wasPlaying) {
      this.schedulePlayer();
    } else if (!seq.playing && wasPlaying) {
      this.clearTimer(this.playerVoice);
    } else if (seq.playing) {
      // tempo/pattern change — reschedule on next tick naturally via step loop reading latest
    }
  }

  getPlayerSequencer(): SequencerState {
    return cloneSequencer(this.playerSeq);
  }

  getIntensity(stageId: GenreStageId): number {
    const gains = computeStageGains(this.playerX, this.playerZ);
    return stageIntensity(gains[stageId], this.dayPhase);
  }

  getLocalIntensity(): number {
    const gains = computeStageGains(this.playerX, this.playerZ);
    let max = 0;
    for (const s of GENRE_STAGES) {
      max = Math.max(max, stageIntensity(gains[s.id], this.dayPhase));
    }
    const pg = playerStageGain(this.playerX, this.playerZ, PLOT_CENTER.x, PLOT_CENTER.z);
    if (this.playerSeq.playing) {
      const dens =
        this.playerSeq.tracks.flat().filter(Boolean).length /
        (this.playerSeq.tracks.length * 16);
      max = Math.max(max, (0.25 + dens * 1.5) * pg);
    }
    return Math.min(1, max);
  }

  getBeatPulse(): number {
    if (!this.playerSeq.playing) return 0;
    const step = this.playerVoice?.step ?? 0;
    return step % 4 === 0 ? 1 : 0.35;
  }

  update(): void {
    if (!this.started || !this.ctx) return;
    const gains = computeStageGains(this.playerX, this.playerZ);
    const t = this.now();
    for (const s of GENRE_STAGES) {
      const voice = this.stageVoices.get(s.id);
      if (!voice) continue;
      const night = 0.75 + 0.35 * (1 - Math.max(0, Math.sin((this.dayPhase - 0.25) * Math.PI * 2)));
      const target = gains[s.id] * 0.55 * night;
      voice.gain.gain.setTargetAtTime(target, t, 0.15);
    }
    if (this.playerVoice) {
      const pg = playerStageGain(this.playerX, this.playerZ, PLOT_CENTER.x, PLOT_CENTER.z);
      const target = this.playerSeq.playing ? pg * 0.7 : 0;
      this.playerVoice.gain.gain.setTargetAtTime(target, t, 0.1);
    }
  }

  private rescheduleAll(): void {
    for (const s of GENRE_STAGES) {
      const voice = this.stageVoices.get(s.id);
      if (!voice) continue;
      this.clearTimer(voice);
      this.scheduleGenre(s.id, voice, s.bpm);
    }
    if (this.playerSeq.playing) this.schedulePlayer();
  }

  private scheduleGenre(id: GenreStageId, voice: Voice, bpm: number): void {
    if (!this.ctx) return;
    const stepDur = 60 / bpm / 4;
    const tick = () => {
      if (!this.ctx || !this.started) return;
      const step = voice.step % 16;
      this.playGenreHit(id, step, voice.gain);
      voice.step++;
      voice.timer = window.setTimeout(tick, stepDur * 1000);
    };
    tick();
  }

  private schedulePlayer(): void {
    if (!this.ctx || !this.playerVoice) return;
    this.clearTimer(this.playerVoice);
    const tick = () => {
      if (!this.ctx || !this.playerVoice || !this.playerSeq.playing) return;
      const stepDur = 60 / this.playerSeq.tempo / 4;
      const step = this.playerVoice.step % 16;
      this.playPlayerStep(step, this.playerVoice.gain);
      this.playerVoice.step++;
      this.playerVoice.timer = window.setTimeout(tick, stepDur * 1000);
    };
    tick();
  }

  private playPlayerStep(step: number, dest: AudioNode): void {
    const tracks = this.playerSeq.tracks;
    if (tracks[0]?.[step]) this.kick(dest, 0.9);
    if (tracks[1]?.[step]) this.snare(dest, 0.7);
    if (tracks[2]?.[step]) this.hat(dest, 0.45);
    if (tracks[3]?.[step]) this.bass(dest, 55, 0.5);
  }

  private playGenreHit(id: GenreStageId, step: number, dest: GainNode): void {
    switch (id) {
      case 'psytrance':
        if (step % 4 === 0) this.kick(dest, 0.85);
        if (step % 2 === 0) this.hat(dest, 0.25);
        if (step % 8 === 4) this.bass(dest, 65, 0.55, 'sawtooth');
        if (step === 0 || step === 6 || step === 12) this.lead(dest, 220 + (step % 5) * 40, 0.12);
        break;
      case 'tekk':
        if (step % 4 === 0) this.kick(dest, 1, 0.04);
        if (step % 8 === 2) this.snare(dest, 0.35);
        if (step % 4 === 2) this.hat(dest, 0.2);
        if (step === 0 || step === 8) this.stab(dest, 110, 0.4);
        break;
      case 'ghettohouse':
        if (step % 4 === 0) this.kick(dest, 0.8);
        if (step === 4 || step === 12) this.snare(dest, 0.55);
        if (step % 2 === 1) this.hat(dest, 0.35, true);
        if (step === 0 || step === 3 || step === 10) this.bass(dest, 70, 0.4, 'square');
        break;
      case 'hardstyle':
        if (step % 4 === 0) this.kick(dest, 1.1, 0.05);
        if (step % 8 === 4) this.reverseBass(dest);
        if (step % 2 === 0) this.hat(dest, 0.2);
        if (step === 0 || step === 8) this.screech(dest);
        break;
      case 'melodicdnb':
        // breakbeat-ish pattern
        if (step === 0 || step === 10) this.kick(dest, 0.85);
        if (step === 4 || step === 12) this.snare(dest, 0.7);
        if (step % 2 === 0) this.hat(dest, 0.3);
        if (step === 0 || step === 6 || step === 11) this.lead(dest, 330 + step * 8, 0.1);
        if (step === 0) this.pad(dest, 165, 0.08);
        break;
    }
  }

  private kick(dest: AudioNode, vol = 0.8, decay = 0.12): void {
    if (!this.ctx) return;
    const t = this.now();
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + decay);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + decay + 0.05);
    osc.connect(g);
    g.connect(dest);
    osc.start(t);
    osc.stop(t + decay + 0.06);
  }

  private snare(dest: AudioNode, vol = 0.6): void {
    if (!this.ctx) return;
    const t = this.now();
    const noise = this.noiseBurst(0.12);
    const g = this.ctx.createGain();
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    noise.connect(bp);
    bp.connect(g);
    g.connect(dest);
    noise.start(t);
    noise.stop(t + 0.13);
  }

  private hat(dest: AudioNode, vol = 0.3, open = false): void {
    if (!this.ctx) return;
    const t = this.now();
    const noise = this.noiseBurst(open ? 0.1 : 0.04);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (open ? 0.1 : 0.04));
    noise.connect(hp);
    hp.connect(g);
    g.connect(dest);
    noise.start(t);
    noise.stop(t + 0.12);
  }

  private bass(
    dest: AudioNode,
    freq: number,
    vol = 0.45,
    type: OscillatorType = 'triangle',
  ): void {
    if (!this.ctx) return;
    const t = this.now();
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(800, t);
    f.frequency.exponentialRampToValueAtTime(120, t + 0.2);
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(f);
    f.connect(g);
    g.connect(dest);
    osc.start(t);
    osc.stop(t + 0.28);
  }

  private lead(dest: AudioNode, freq: number, vol: number): void {
    if (!this.ctx) return;
    const t = this.now();
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 2200;
    osc.connect(f);
    f.connect(g);
    g.connect(dest);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  private stab(dest: AudioNode, freq: number, vol: number): void {
    if (!this.ctx) return;
    const t = this.now();
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const dist = this.ctx.createWaveShaper();
    dist.curve = this.makeDistortion(40);
    osc.type = 'square';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(dist);
    dist.connect(g);
    g.connect(dest);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  private reverseBass(dest: AudioNode): void {
    if (!this.ctx) return;
    const t = this.now();
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(40, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.2);
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.55, t + 0.18);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc.connect(g);
    g.connect(dest);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  private screech(dest: AudioNode): void {
    if (!this.ctx) return;
    const t = this.now();
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(1600, t + 0.15);
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(g);
    g.connect(dest);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  private pad(dest: AudioNode, freq: number, vol: number): void {
    if (!this.ctx) return;
    const t = this.now();
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
    osc.connect(g);
    g.connect(dest);
    osc.start(t);
    osc.stop(t + 0.85);
  }

  private noiseBurst(duration: number): AudioBufferSourceNode {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    return src;
  }

  private makeDistortion(amount: number): Float32Array<ArrayBuffer> {
    const n = 256;
    const curve = new Float32Array(new ArrayBuffer(n * 4));
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  private clearTimer(voice: Voice): void {
    if (voice.timer != null) {
      clearTimeout(voice.timer);
      voice.timer = null;
    }
  }

  private now(): number {
    return this.ctx?.currentTime ?? 0;
  }

  dispose(): void {
    for (const v of this.stageVoices.values()) this.clearTimer(v);
    if (this.playerVoice) this.clearTimer(this.playerVoice);
    void this.ctx?.close();
    this.started = false;
  }
}
