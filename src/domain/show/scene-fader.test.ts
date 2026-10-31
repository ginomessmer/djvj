import { describe, expect, it } from 'vitest';
import { SceneFader } from './scene-fader';

const STEP = 1 / 60;

function run(fader: SceneFader<string>, wanted: string, seconds: number, instant = false) {
  let frame = fader.update(wanted, STEP, instant);
  for (let i = 1; i < seconds * 60; i++) frame = fader.update(wanted, STEP, instant);
  return frame;
}

describe('SceneFader', () => {
  it('starts dark and fades the first scene in', () => {
    const fader = new SceneFader('a');
    expect(fader.update('a', STEP).brightness).toBeLessThan(0.1);
    expect(run(fader, 'a', 0.5).brightness).toBe(1);
  });

  it('dips to black before showing a different scene', () => {
    const fader = new SceneFader('a');
    run(fader, 'a', 1);

    const midFade = run(fader, 'b', 0.15);
    expect(midFade.shownId).toBe('a'); // still the old scene, getting darker
    expect(midFade.brightness).toBeLessThan(1);

    const done = run(fader, 'b', 1);
    expect(done.shownId).toBe('b');
    expect(done.brightness).toBe(1);
  });

  it('switches instantly at full brightness when asked to', () => {
    const fader = new SceneFader('a');
    expect(fader.update('b', STEP, true)).toEqual({ shownId: 'b', brightness: 1 });
  });
});
