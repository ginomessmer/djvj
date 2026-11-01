import { describe, expect, it } from 'vitest';
import { SceneMixer } from './scene-mixer';

const STEP = 1 / 60;

function run(mixer: SceneMixer<string>, wanted: string, seconds: number, durationSec: number) {
  let frame = mixer.update(wanted, STEP, durationSec);
  for (let t = STEP; t < seconds; t += STEP) frame = mixer.update(wanted, STEP, durationSec);
  return frame;
}

describe('SceneMixer', () => {
  it('fades in once at start-up', () => {
    const mixer = new SceneMixer('a');
    expect(mixer.update('a', STEP, 1).brightness).toBeLessThan(0.1);
    expect(run(mixer, 'a', 1, 1)).toEqual({ fromId: 'a', toId: 'a', mix: 1, brightness: 1 });
  });

  it('crossfades over the given duration, at full brightness', () => {
    const mixer = new SceneMixer('a');
    run(mixer, 'a', 1, 1);
    const half = run(mixer, 'b', 0.5, 1);
    expect(half).toMatchObject({ fromId: 'a', toId: 'b', brightness: 1 });
    expect(half.mix).toBeGreaterThan(0.3);
    expect(half.mix).toBeLessThan(0.7);
    expect(run(mixer, 'b', 0.6, 1)).toMatchObject({ fromId: 'b', toId: 'b', mix: 1 });
  });

  it('cuts when the duration is zero', () => {
    const mixer = new SceneMixer('a');
    run(mixer, 'a', 1, 1);
    expect(mixer.update('b', STEP, 0)).toMatchObject({ fromId: 'b', toId: 'b', mix: 1 });
  });

  it('carries on from the dominant scene when interrupted', () => {
    const mixer = new SceneMixer('a');
    run(mixer, 'a', 1, 1);
    run(mixer, 'b', 0.8, 1); // mostly b
    expect(mixer.update('c', STEP, 1)).toMatchObject({ fromId: 'b', toId: 'c' });
  });
});
