import { describe, expect, it } from 'vitest';
import type { Section } from '../rhythm/section-tracker';
import { type OverlayInput, OverlayScheduler } from './overlay-scheduler';

const STEP = 1 / 60;
const BEAT_SEC = 60 / 128;

function run(
  scheduler: OverlayScheduler,
  seconds: number,
  input: Partial<OverlayInput>,
  start = 0,
) {
  let frame = { opacity: 0, layout: 'corner' as const } as ReturnType<OverlayScheduler['update']>;
  for (let t = start; t < start + seconds; t += STEP) {
    const beatHit = Math.floor((t + STEP) / BEAT_SEC) > Math.floor(t / BEAT_SEC);
    frame = scheduler.update(STEP, {
      mode: 'reveal',
      hasContent: true,
      live: true,
      section: 'groove' as Section,
      beatHit,
      ...input,
    });
  }
  return frame;
}

describe('OverlayScheduler', () => {
  it('shows nothing when off or without a name or logo', () => {
    expect(run(new OverlayScheduler(), 5, { mode: 'off' }).opacity).toBe(0);
    expect(run(new OverlayScheduler(), 5, { mode: 'corner', hasContent: false }).opacity).toBe(0);
  });

  it('fades the corner mark in and keeps it', () => {
    const scheduler = new OverlayScheduler();
    expect(run(scheduler, 0.5, { mode: 'corner' }).opacity).toBeLessThan(0.8);
    expect(run(scheduler, 5, { mode: 'corner' })).toEqual({ opacity: 0.8, layout: 'corner' });
  });

  it('reveals in the centre for 16 beats after a drop', () => {
    const scheduler = new OverlayScheduler();
    run(scheduler, 10, {});
    const during = run(scheduler, 3, { section: 'drop' }, 10);
    expect(during).toEqual({ opacity: 1, layout: 'centre' });
    const after = run(scheduler, 16 * BEAT_SEC + 2, { section: 'drop' }, 13);
    expect(after.opacity).toBe(0);
  });

  it('reveals now and then even without a drop', () => {
    const scheduler = new OverlayScheduler({ revealEverySec: 30, revealSec: 6 });
    expect(run(scheduler, 29, {}).opacity).toBe(0);
    expect(run(scheduler, 4, {}, 29).opacity).toBe(1);
    expect(run(scheduler, 10, {}, 33).opacity).toBe(0);
  });

  it('never reveals while the music is silent', () => {
    expect(run(new OverlayScheduler({ revealEverySec: 1 }), 5, { live: false }).opacity).toBe(0);
  });
});
