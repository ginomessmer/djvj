import { describe, expect, it } from 'vitest';
import { TapTempo } from './tap-tempo';

describe('TapTempo', () => {
  it('needs four taps', () => {
    const tapper = new TapTempo();
    expect([0, 0.5, 1].map((t) => tapper.tap(t))).toEqual([null, null, null]);
    expect(tapper.tap(1.5)).not.toBeNull();
  });

  it('finds tempo and phase, and forgives a sloppy tap', () => {
    const tapper = new TapTempo();
    const beat = 60 / 128;
    const sloppy = [0, beat + 0.03, 2 * beat - 0.02, 3 * beat, 4 * beat + 0.01, 5 * beat];
    let result = null;
    for (const t of sloppy) result = tapper.tap(10 + t);
    expect(60 / (result?.periodSec ?? 1)).toBeGreaterThan(126.5);
    expect(60 / (result?.periodSec ?? 1)).toBeLessThan(129.5);
    expect(Math.abs((result?.beatSec ?? 0) - (10 + 5 * beat))).toBeLessThan(0.02);
  });

  it('starts over after a pause', () => {
    const tapper = new TapTempo();
    for (const t of [0, 0.5, 1, 1.5]) tapper.tap(t);
    expect(tapper.tap(10)).toBeNull();
  });

  it('ignores tempos no one plays', () => {
    const tapper = new TapTempo();
    for (const t of [0, 0.1, 0.2]) tapper.tap(t);
    expect(tapper.tap(0.3)).toBeNull(); // 600 BPM
  });
});
