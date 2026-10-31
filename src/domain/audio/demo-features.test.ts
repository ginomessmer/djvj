import { describe, expect, it } from 'vitest';
import { demoFeatures } from './demo-features';
import { idleFeatures } from './idle-features';

const BEAT_SEC = 60 / 128;
const BAR_SEC = BEAT_SEC * 4;
const inUnitRange = (...values: number[]) => values.every((value) => value >= 0 && value <= 1);

describe('demoFeatures', () => {
  it('stays within 0..1', () => {
    for (let t = 0; t < 120; t += 0.037) {
      const features = demoFeatures(t);
      expect(features.signal).toBe(true);
      expect(
        inUnitRange(
          features.energy,
          features.kick,
          features.onset,
          features.lowEndFlux,
          ...features.bands,
        ),
      ).toBe(true);
    }
  });

  it('kicks once per beat in the groove', () => {
    expect(demoFeatures(BEAT_SEC * 4).kick).toBeGreaterThan(0.95);
    expect(demoFeatures(BEAT_SEC * 4.6).kick).toBeLessThan(0.1);
    let hits = 0;
    for (let t = 0; t < BAR_SEC * 4; t += 1 / 60) if (demoFeatures(t).kickHit) hits++;
    expect(hits).toBe(16);
  });

  it('has a breakdown without kick and with rising highs', () => {
    const early = demoFeatures(BAR_SEC * 24.5);
    const late = demoFeatures(BAR_SEC * 31.5);
    expect(early.kick).toBe(0);
    expect(late.kick).toBe(0);
    expect(late.bandsDb[4]).toBeGreaterThan(early.bandsDb[4] + 10);
    expect(late.bandsDb[0] - late.loudnessDb).toBeLessThan(-30); // no bass, relative to the mix
  });
});

describe('idleFeatures', () => {
  it('breathes gently without a signal', () => {
    for (let t = 0; t < 60; t += 0.5) {
      const features = idleFeatures(t);
      expect(features.signal).toBe(false);
      expect(features.kick).toBe(0);
      expect(inUnitRange(features.energy, ...features.bands)).toBe(true);
      expect(features.energy).toBeGreaterThan(0.1);
    }
  });
});
