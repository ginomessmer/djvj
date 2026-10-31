import { describe, expect, it } from 'vitest';
import { demoFeatures } from './demo-features';
import { idleFeatures } from './idle-features';

const inUnitRange = (...values: number[]) => values.every((value) => value >= 0 && value <= 1);

describe('demoFeatures', () => {
  it('stays within 0..1 and pulses on the beat', () => {
    const beatSec = 60 / 128;
    for (let t = 0; t < 30; t += 0.037) {
      const features = demoFeatures(t);
      expect(features.signal).toBe(true);
      expect(inUnitRange(features.energy, features.kick, features.onset, ...features.bands)).toBe(
        true,
      );
    }
    expect(demoFeatures(beatSec * 4).kick).toBeGreaterThan(0.95);
    expect(demoFeatures(beatSec * 4 + beatSec * 0.6).kick).toBeLessThan(0.1);
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
