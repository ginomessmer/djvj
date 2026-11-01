import { describe, expect, it } from 'vitest';
import { FlashGuard } from './flash-guard';
import { meanRelativeLuminance } from './luminance';

const STEP = 1 / 60;

/** Observes a square wave of the given frequency and amplitude for `seconds`. */
function squareWave(guard: FlashGuard, hz: number, amplitude: number, seconds: number, start = 0) {
  for (let t = start; t < start + seconds; t += STEP) {
    const high = Math.floor(t * hz * 2) % 2 === 1;
    guard.observe(t, 0.2 + (high ? amplitude : 0));
  }
  return start + seconds;
}

describe('FlashGuard', () => {
  it('stays calm with a steady image', () => {
    const guard = new FlashGuard();
    for (let t = 0; t < 5; t += STEP) guard.observe(t, 0.4);
    expect(guard.calm(5)).toBe(0);
  });

  it('allows beat pulses up to 160 BPM (fewer than three flashes a second)', () => {
    const guard = new FlashGuard();
    const end = squareWave(guard, 160 / 60, 0.3, 5);
    expect(guard.calm(end)).toBe(0);
  });

  it('steps in at three flashes a second', () => {
    const guard = new FlashGuard();
    const end = squareWave(guard, 3, 0.3, 3);
    expect(guard.calm(end)).toBe(1);
  });

  it('catches a pulse running at twice the beat (raw kick firing on the off-beat bass)', () => {
    const guard = new FlashGuard();
    const end = squareWave(guard, (2 * 128) / 60, 0.2, 3);
    expect(guard.calm(end)).toBe(1);
  });

  it('ignores fast but small flicker', () => {
    const guard = new FlashGuard();
    const end = squareWave(guard, 8, 0.05, 3);
    expect(guard.calm(end)).toBe(0);
  });

  it('holds, then releases gradually once the flashing has left the one-second window', () => {
    const guard = new FlashGuard({ releaseSec: 2 });
    const end = squareWave(guard, 5, 0.3, 2);
    for (let t = end; t < end + 8; t += STEP) guard.observe(t, 0.2);
    expect(guard.calm(end + 2)).toBe(1); // still holding
    const release = [3, 3.5, 4, 4.5].map((s) => guard.calm(end + s));
    for (let i = 1; i < release.length; i++) expect(release[i]).toBeLessThanOrEqual(release[i - 1]);
    expect(guard.calm(end + 6)).toBe(0); // within hold + release after the window cleared
  });
});

describe('meanRelativeLuminance', () => {
  it('is 0 for black, 1 for white, and weighs green most', () => {
    expect(meanRelativeLuminance([0, 0, 0, 255])).toBe(0);
    expect(meanRelativeLuminance([255, 255, 255, 255])).toBeCloseTo(1, 5);
    expect(meanRelativeLuminance([0, 255, 0, 255])).toBeGreaterThan(
      meanRelativeLuminance([255, 0, 0, 255]),
    );
    expect(meanRelativeLuminance([0, 0, 0, 255, 255, 255, 255, 255])).toBeCloseTo(0.5, 5);
  });
});
