import { describe, expect, it } from 'vitest';
import { SceneRotator } from './rotator';

/** Deterministic rng that cycles through fixed values. */
function seq(...values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length] as number;
}

describe('SceneRotator', () => {
  it('waits a full interval before the first change', () => {
    const r = new SceneRotator(['a', 'b', 'c'], seq(0.5), 40);
    expect(r.tick(0, true)).toBeNull(); // arms the timer (40 s ±20 %)
    expect(r.tick(20, true)).toBeNull();
    expect(r.tick(39, true)).toBeNull();
    expect(r.tick(100, true)).not.toBeNull();
  });

  it('never repeats the current scene and stays inside the list', () => {
    const r = new SceneRotator(['a', 'b', 'c'], Math.random, 10);
    let current = r.current;
    let t = 0;
    r.tick(t, true);
    for (let i = 0; i < 200; i++) {
      t += 100;
      const next = r.tick(t, true);
      if (next) {
        expect(next).not.toBe(current);
        expect(['a', 'b', 'c']).toContain(next);
        current = next;
      }
    }
  });

  it('does not run while inactive (silence or locked) and restarts the timer afterwards', () => {
    const r = new SceneRotator(['a', 'b'], seq(0.5), 10);
    r.tick(0, true);
    expect(r.tick(1000, false)).toBeNull();
    expect(r.tick(1001, true)).toBeNull(); // re-armed, not an immediate switch
  });

  it('does nothing with fewer than two scenes', () => {
    const r = new SceneRotator(['only'], seq(0.5), 1);
    r.tick(0, true);
    expect(r.tick(1000, true)).toBeNull();
  });

  it('restarts its timer when a scene is picked manually', () => {
    const r = new SceneRotator(['a', 'b', 'c'], seq(0.5), 10);
    r.tick(0, true);
    r.setCurrent('c');
    expect(r.current).toBe('c');
    expect(r.tick(500, true)).toBeNull(); // timer was reset, so this only re-arms
  });
});
