import { describe, expect, it } from 'vitest';
import { type OverlayInput, OverlayScheduler } from './overlay-scheduler';

const STEP = 1 / 60;

function run(scheduler: OverlayScheduler, seconds: number, input: Partial<OverlayInput>) {
  let frame = { opacity: 0 };
  for (let t = 0; t < seconds; t += STEP) {
    frame = scheduler.update(STEP, { mode: 'corner', hasContent: true, headline: false, ...input });
  }
  return frame;
}

describe('OverlayScheduler', () => {
  it('shows nothing when off, in reveal mode or without a name or logo', () => {
    expect(run(new OverlayScheduler(), 5, { mode: 'off' }).opacity).toBe(0);
    expect(run(new OverlayScheduler(), 5, { mode: 'reveal' }).opacity).toBe(0);
    expect(run(new OverlayScheduler(), 5, { hasContent: false }).opacity).toBe(0);
  });

  it('fades the corner mark in and keeps it', () => {
    const scheduler = new OverlayScheduler();
    expect(run(scheduler, 0.5, {}).opacity).toBeLessThan(0.8);
    expect(run(scheduler, 5, {}).opacity).toBe(0.8);
  });

  it('steps aside while a headline text is on screen, and comes back after', () => {
    const scheduler = new OverlayScheduler();
    run(scheduler, 5, {});
    expect(run(scheduler, 3, { headline: true }).opacity).toBe(0);
    expect(run(scheduler, 3, {}).opacity).toBe(0.8);
  });
});
