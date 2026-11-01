import { describe, expect, it } from 'vitest';
import { AdaptiveRange } from './adaptive-range';

const FRAME_SEC = 1 / 60;

/** Alternates between two levels each frame and returns the last output seen for each. */
function alternate(range: AdaptiveRange, loudDb: number, quietDb: number, frames: number) {
  let loud = 0;
  let quiet = 1;
  for (let frame = 0; frame < frames; frame++) {
    const isLoud = frame % 2 === 0;
    const out = range.normalize(isLoud ? loudDb : quietDb, FRAME_SEC);
    if (isLoud) loud = out;
    else quiet = out;
  }
  return { loud, quiet };
}

describe('AdaptiveRange', () => {
  it('maps the recent quiet..loud range onto 0..1', () => {
    const { loud, quiet } = alternate(new AdaptiveRange(), -30, -60, 600);
    expect(loud).toBeGreaterThan(0.95);
    expect(quiet).toBeLessThan(0.05);
  });

  it('adapts when the input gets much louder (e.g. a hotter line-in)', () => {
    const range = new AdaptiveRange();
    alternate(range, -60, -80, 600);
    const { loud, quiet } = alternate(range, -10, -35, 60 * 120);
    expect(loud).toBeGreaterThan(0.95);
    expect(quiet).toBeLessThan(0.1);
  });

  it('does not blow a constantly faint band up to full scale', () => {
    const range = new AdaptiveRange();
    let out = 1;
    for (let frame = 0; frame < 300; frame++) out = range.normalize(-90, FRAME_SEC);
    expect(out).toBeLessThan(0.1);
  });

  it('survives non-finite input', () => {
    const range = new AdaptiveRange();
    expect(range.normalize(Number.NEGATIVE_INFINITY, FRAME_SEC)).toBe(0);
    expect(range.normalize(Number.NaN, FRAME_SEC)).toBe(0);
    expect(Number.isFinite(range.normalize(-30, FRAME_SEC))).toBe(true);
  });
});
