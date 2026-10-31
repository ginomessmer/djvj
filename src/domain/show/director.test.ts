import { describe, expect, it } from 'vitest';
import { Director, type DirectorInput } from './director';

const STEP = 1 / 60;
const live: DirectorInput = { auto: true, panic: false, selectedId: 'tunnel', live: true };

/**
 * Runs the director for `seconds` and returns the last frame. Like the real runtime, it feeds the
 * returned selection back in, so a rotation is not mistaken for a manual pick.
 */
function run(director: Director, input: DirectorInput, seconds: number, startSec = 0) {
  let current = input;
  let frame = director.update(startSec, STEP, current);
  for (let t = startSec + STEP; t < startSec + seconds; t += STEP) {
    current = { ...current, selectedId: frame.selectedId };
    frame = director.update(t, STEP, current);
  }
  return frame;
}

describe('Director', () => {
  it('shows the selected scene while there is music', () => {
    const frame = run(new Director('tunnel'), live, 1);
    expect(frame.shownId).toBe('tunnel');
    expect(frame.brightness).toBe(1);
  });

  it('panic shows the safe scene immediately at full brightness', () => {
    const frame = new Director('tunnel').update(0, STEP, { ...live, panic: true });
    expect(frame).toMatchObject({ shownId: 'ambient', brightness: 1 });
  });

  it('falls back to the idle scene on silence, but only in auto mode', () => {
    const silent = { ...live, live: false };
    expect(run(new Director('tunnel'), silent, 2).shownId).toBe('fluid');
    expect(run(new Director('tunnel'), { ...silent, auto: false }, 2).shownId).toBe('tunnel');
  });

  it('rotates to another scene after its interval while music plays', () => {
    const director = new Director('tunnel', { intervalSec: 10, rng: () => 0.5 });
    expect(run(director, live, 5).selectedId).toBe('tunnel');
    expect(run(director, { ...live, selectedId: 'tunnel' }, 20, 5).selectedId).not.toBe('tunnel');
  });

  it('does not rotate when auto is off, and re-enabling it waits a full interval', () => {
    const director = new Director('tunnel', { intervalSec: 10, rng: () => 0.5 });
    const locked = { ...live, auto: false };
    expect(run(director, locked, 100).selectedId).toBe('tunnel');
    // auto comes back on after a long locked period: no instant jump
    expect(director.update(100.5, STEP, live).selectedId).toBe('tunnel');
  });
});
