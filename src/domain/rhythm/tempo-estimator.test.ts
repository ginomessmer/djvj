import { describe, expect, it } from 'vitest';
import { TempoEstimator } from './tempo-estimator';
import { type Frame, kickTrain, randomOnsets, silence } from './test-signals';

function estimate(frames: Frame[], estimator = new TempoEstimator()) {
  let result = { bpm: 0, confidence: 0 };
  for (const { tSec, features } of frames) result = estimator.update(tSec, features.lowEndFlux);
  return result;
}

describe('TempoEstimator', () => {
  it.each([118, 124, 128, 135, 140, 150, 158])('finds %i BPM from a plain kick', (bpm) => {
    const { bpm: found, confidence } = estimate(kickTrain({ bpm, seconds: 10 }));
    expect(Math.abs(found - bpm)).toBeLessThan(1);
    expect(confidence).toBeGreaterThan(0.6);
  });

  it('is not fooled into double tempo by an off-beat bass', () => {
    const { bpm } = estimate(kickTrain({ bpm: 128, seconds: 10, offBeatStrength: 0.5 }));
    expect(Math.abs(bpm - 128)).toBeLessThan(1);
  });

  it('copes with irregular frame times', () => {
    const { bpm } = estimate(kickTrain({ bpm: 132, seconds: 10, jitter: true }));
    expect(Math.abs(bpm - 132)).toBeLessThan(1);
  });

  it('has no tempo before it heard enough', () => {
    expect(estimate(kickTrain({ bpm: 128, seconds: 2 })).bpm).toBe(0);
  });

  it('follows a tempo change (the DJ pitching up)', () => {
    const estimator = new TempoEstimator();
    estimate(kickTrain({ bpm: 128, seconds: 12 }), estimator);
    const { bpm } = estimate(kickTrain({ bpm: 132, seconds: 12, startSec: 12 }), estimator);
    expect(Math.abs(bpm - 132)).toBeLessThan(1);
  });

  it('keeps the tempo but loses confidence when the kick stops', () => {
    const estimator = new TempoEstimator();
    estimate(kickTrain({ bpm: 128, seconds: 10 }), estimator);
    const { bpm, confidence } = estimate(silence(10, 10, true), estimator);
    expect(Math.abs(bpm - 128)).toBeLessThan(1);
    expect(confidence).toBeLessThan(0.2);
  });

  it('is not confident about random onsets', () => {
    expect(estimate(randomOnsets(12)).confidence).toBeLessThan(0.3);
  });
});
