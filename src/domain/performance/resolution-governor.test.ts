import { describe, expect, it } from 'vitest';
import { ResolutionGovernor } from './resolution-governor';

function run(governor: ResolutionGovernor, fps: number, seconds: number, enabled = true) {
  let scale = governor.scale;
  for (let t = 0; t < seconds; t += 1 / fps) scale = governor.update(1 / fps, enabled);
  return scale;
}

describe('ResolutionGovernor', () => {
  it('leaves a smooth 60 fps alone', () => {
    expect(run(new ResolutionGovernor(), 60, 30)).toBe(1);
  });

  it('steps down while frames are slow, not below the minimum', () => {
    const governor = new ResolutionGovernor();
    expect(run(governor, 30, 2.5)).toBeLessThan(1);
    expect(run(governor, 30, 60)).toBe(0.35);
  });

  it('comes back up slowly once there is headroom', () => {
    const governor = new ResolutionGovernor();
    run(governor, 30, 5);
    const low = governor.scale;
    expect(run(governor, 60, 3)).toBeLessThanOrEqual(low); // not up yet (the average lags behind)
    expect(run(governor, 60, 60)).toBe(1);
  });

  it('does nothing when switched off', () => {
    const governor = new ResolutionGovernor();
    run(governor, 30, 5);
    expect(run(governor, 30, 1, false)).toBe(1);
  });
});
