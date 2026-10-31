import { describe, expect, it } from 'vitest';
import { SceneRotator } from './scene-rotator';

/** Deterministic rng that cycles through fixed values. */
function sequence(...values: number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length];
}

describe('SceneRotator', () => {
  it('waits a full interval before the first change', () => {
    const rotator = new SceneRotator(['a', 'b', 'c'], 'a', { intervalSec: 40, rng: sequence(0.5) });
    expect(rotator.tick(0, true)).toBeNull(); // arms the timer
    expect(rotator.tick(39, true)).toBeNull();
    expect(rotator.tick(100, true)).not.toBeNull();
  });

  it('never repeats the current scene and stays inside the list', () => {
    const rotator = new SceneRotator(['a', 'b', 'c'], 'a', { intervalSec: 10 });
    let current = 'a';
    rotator.tick(0, true);
    for (let t = 100; t < 20000; t += 100) {
      const next = rotator.tick(t, true);
      if (!next) continue;
      expect(next).not.toBe(current);
      expect(['a', 'b', 'c']).toContain(next);
      current = next;
    }
  });

  it('does not run while inactive and waits a full interval after re-activation', () => {
    const rotator = new SceneRotator(['a', 'b'], 'a', { intervalSec: 10, rng: sequence(0.5) });
    rotator.tick(0, true);
    expect(rotator.tick(1000, false)).toBeNull();
    expect(rotator.tick(1001, true)).toBeNull(); // re-armed, not an immediate switch
  });

  it('does nothing with fewer than two scenes', () => {
    const rotator = new SceneRotator(['only'], 'only', { intervalSec: 1 });
    rotator.tick(0, true);
    expect(rotator.tick(1000, true)).toBeNull();
  });

  it('restarts its timer when the scene is changed from outside', () => {
    const rotator = new SceneRotator(['a', 'b', 'c'], 'a', { intervalSec: 10, rng: sequence(0.5) });
    rotator.tick(0, true);
    rotator.sync('c');
    expect(rotator.tick(500, true)).toBeNull(); // timer was reset, so this only re-arms
  });
});
