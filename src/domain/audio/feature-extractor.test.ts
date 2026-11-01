import { describe, expect, it } from 'vitest';
import { BAND_COUNT } from './bands';
import { FeatureExtractor } from './feature-extractor';

const SAMPLE_RATE = 48000;
const BIN_COUNT = 1024; // fftSize 2048
const BIN_HZ = SAMPLE_RATE / (BIN_COUNT * 2);
const FPS = 60;
const MUSIC_RMS = 0.1; // -20 dBFS
const SILENT_RMS = 1e-4; // -80 dBFS

interface Peak {
  fromHz: number;
  toHz: number;
  db: number;
}

function spectrum(peaks: Peak[], floorDb: number): Float32Array {
  const bins = new Float32Array(BIN_COUNT).fill(floorDb);
  for (const { fromHz, toHz, db } of peaks) {
    for (let bin = Math.round(fromHz / BIN_HZ); bin <= Math.round(toHz / BIN_HZ); bin++) {
      bins[bin] = db;
    }
  }
  return bins;
}

const newExtractor = () =>
  new FeatureExtractor({ sampleRate: SAMPLE_RATE, binCount: BIN_COUNT, silenceDb: -52 });

const BASS = { fromHz: 60, toHz: 250 };

describe('FeatureExtractor', () => {
  it('maps energy into the right band', () => {
    const extractor = newExtractor();
    const frame = spectrum([{ ...BASS, db: -20 }], -90);
    let features = extractor.process(frame, MUSIC_RMS, 0);
    for (let i = 1; i < FPS * 3; i++) features = extractor.process(frame, MUSIC_RMS, i / FPS);

    expect(features.signal).toBe(true);
    expect(features.bands).toHaveLength(BAND_COUNT);
    expect(features.bands[1]).toBeGreaterThan(0.8); // bass
    expect(features.bands[4]).toBeLessThan(0.2); // highs
  });

  it('reports silence as no signal with all-zero visuals', () => {
    const extractor = newExtractor();
    const frame = spectrum([], -100);
    let features = extractor.process(frame, SILENT_RMS, 0);
    for (let i = 1; i < FPS * 2; i++) features = extractor.process(frame, SILENT_RMS, i / FPS);

    expect(features.signal).toBe(false);
    expect(features.bands.every((band) => band === 0)).toBe(true);
    expect(features.energy).toBe(0);
  });

  it('keeps the signal through a short gap, then goes idle and fades out', () => {
    const extractor = newExtractor();
    const music = spectrum([{ ...BASS, db: -20 }], -90);
    const silence = spectrum([], -100);
    let t = 0;
    const run = (frame: Float32Array, rms: number, seconds: number) => {
      let features = extractor.process(frame, rms, t);
      for (let i = 0; i < seconds * FPS; i++) {
        t += 1 / FPS;
        features = extractor.process(frame, rms, t);
      }
      return features;
    };

    expect(run(music, MUSIC_RMS, 2).signal).toBe(true);
    expect(run(silence, SILENT_RMS, 1).signal).toBe(true); // 1 s gap: still "music"
    const after = run(silence, SILENT_RMS, 4);
    expect(after.signal).toBe(false);
    expect(Math.max(...after.bands)).toBeLessThan(0.05);
  });

  it('detects roughly one low-end onset per beat at 128 BPM, not many more', () => {
    const extractor = newExtractor();
    const beatSec = 60 / 128;
    const kick = spectrum([{ ...BASS, db: -25 }], -80);
    const hat = spectrum(
      [
        { ...BASS, db: -80 },
        { fromHz: 6000, toHz: 16000, db: -60 },
      ],
      -95,
    );
    const quiet = spectrum([{ ...BASS, db: -80 }], -95);

    let hits = 0;
    for (let i = 0; i < FPS * 10; i++) {
      const t = i / FPS;
      const inBeat = t % beatSec;
      const frame = inBeat < 0.08 ? kick : Math.abs(inBeat - beatSec / 2) < 0.04 ? hat : quiet;
      if (extractor.process(frame, MUSIC_RMS, t).kickHit) hits++;
    }
    // 10 s is about 21 beats; the first one falls into the signal gate's warm-up.
    expect(hits).toBeGreaterThanOrEqual(19);
    expect(hits).toBeLessThanOrEqual(22);
  });
});
