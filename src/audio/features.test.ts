import { describe, expect, it } from 'vitest';
import { demoFeatures } from './demo';
import { BAND_COUNT, FeatureExtractor } from './features';

const SR = 48000;
const BINS = 1024; // fftSize 2048
const BIN_HZ = SR / (BINS * 2);
const FPS = 60;

interface Part {
  fromHz: number;
  toHz: number;
  db: number;
}

function spectrum(parts: Part[], floorDb = -100): Float32Array {
  const out = new Float32Array(BINS).fill(floorDb);
  for (const p of parts) {
    for (let k = Math.round(p.fromHz / BIN_HZ); k <= Math.round(p.toHz / BIN_HZ); k++) out[k] = p.db;
  }
  return out;
}

const MUSIC_RMS = 0.1; // -20 dBFS
const SILENT_RMS = 1e-4; // -80 dBFS

describe('FeatureExtractor', () => {
  it('maps energy into the right band', () => {
    const fx = new FeatureExtractor({ sampleRate: SR, binCount: BINS });
    const frame = spectrum([{ fromHz: 60, toHz: 250, db: -20 }], -90);
    let f = fx.process(frame, MUSIC_RMS, 0);
    for (let i = 1; i < FPS * 3; i++) f = fx.process(frame, MUSIC_RMS, i / FPS);
    expect(f.signal).toBe(true);
    expect(f.bands).toHaveLength(BAND_COUNT);
    expect(f.bands[1]).toBeGreaterThan(0.8); // bass
    expect(f.bands[4]).toBeLessThan(0.2); // highs
  });

  it('reports silence as no signal with all-zero visuals', () => {
    const fx = new FeatureExtractor({ sampleRate: SR, binCount: BINS });
    const frame = spectrum([], -100);
    let f = fx.process(frame, SILENT_RMS, 0);
    for (let i = 1; i < FPS * 2; i++) f = fx.process(frame, SILENT_RMS, i / FPS);
    expect(f.signal).toBe(false);
    expect(f.bands.every((b) => b === 0)).toBe(true);
    expect(f.energy).toBe(0);
  });

  it('keeps the signal through a short gap, then goes idle and fades out', () => {
    const fx = new FeatureExtractor({ sampleRate: SR, binCount: BINS });
    const music = spectrum([{ fromHz: 60, toHz: 250, db: -20 }], -90);
    const silence = spectrum([], -100);
    let t = 0;
    let f = fx.process(music, MUSIC_RMS, t);
    for (let i = 0; i < FPS * 2; i++) f = fx.process(music, MUSIC_RMS, (t += 1 / FPS));
    expect(f.signal).toBe(true);

    for (let i = 0; i < FPS; i++) f = fx.process(silence, SILENT_RMS, (t += 1 / FPS));
    expect(f.signal).toBe(true); // 1 s gap: still "music"

    for (let i = 0; i < FPS * 4; i++) f = fx.process(silence, SILENT_RMS, (t += 1 / FPS));
    expect(f.signal).toBe(false);
    expect(Math.max(...f.bands)).toBeLessThan(0.05);
  });

  it('detects roughly one kick per beat at 128 BPM and not many more', () => {
    const fx = new FeatureExtractor({ sampleRate: SR, binCount: BINS });
    const beat = 60 / 128;
    const kickFrame = spectrum([{ fromHz: 60, toHz: 250, db: -25 }], -80);
    const hatFrame = spectrum(
      [
        { fromHz: 60, toHz: 250, db: -80 },
        { fromHz: 6000, toHz: 16000, db: -60 },
      ],
      -95,
    );
    const quiet = spectrum([{ fromHz: 60, toHz: 250, db: -80 }], -95);

    let kicks = 0;
    for (let i = 0; i < FPS * 10; i++) {
      const t = i / FPS;
      const inBeat = t % beat;
      const frame = inBeat < 0.08 ? kickFrame : Math.abs(inBeat - beat / 2) < 0.04 ? hatFrame : quiet;
      if (fx.process(frame, MUSIC_RMS, t).kickHit) kicks++;
    }
    // 10 s ≈ 21 beats; the first one falls into the signal gate's warm-up.
    expect(kicks).toBeGreaterThanOrEqual(19);
    expect(kicks).toBeLessThanOrEqual(22);
  });
});

describe('demoFeatures', () => {
  it('stays within 0..1 and pulses on the beat', () => {
    const beat = 60 / 128;
    for (let t = 0; t < 30; t += 0.037) {
      const f = demoFeatures(t);
      expect(f.signal).toBe(true);
      for (const v of [f.energy, f.kick, f.onset, ...f.bands]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
    expect(demoFeatures(beat * 4).kick).toBeGreaterThan(0.95);
    expect(demoFeatures(beat * 4 + beat * 0.6).kick).toBeLessThan(0.1);
  });
});
