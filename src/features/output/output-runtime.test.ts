import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestRuntime, runFrames } from '../test-utils';

afterEach(() => vi.unstubAllGlobals());

/** Arguments of the most recent `stage.render` call. */
function lastDraw(stage: { render: ReturnType<typeof vi.fn> }) {
  const [sceneId, frame] = stage.render.mock.calls.at(-1) ?? [];
  return { sceneId, frame };
}

describe('OutputRuntime', () => {
  it('draws the selected scene at full brightness while music plays', () => {
    const { runtime, store, stage } = createTestRuntime();
    store.getState().apply({ demo: true });

    runFrames(runtime, 1);

    const { sceneId, frame } = lastDraw(stage);
    expect(sceneId).toBe('tunnel');
    expect(frame.intensity).toBeCloseTo(1, 1);
    expect(frame.features.energy).toBeGreaterThan(0.3);
  });

  it('shows the idle scene when there is no signal and auto is on', () => {
    const { runtime, stage } = createTestRuntime();
    runFrames(runtime, 1);
    expect(lastDraw(stage).sceneId).toBe('fluid');
  });

  it('keeps the selected scene without a signal when it is locked', () => {
    const { runtime, store, stage } = createTestRuntime();
    store.getState().apply({ auto: false, sceneId: 'rings' });
    runFrames(runtime, 1);
    expect(lastDraw(stage).sceneId).toBe('rings');
  });

  it('fades to black on blackout and shows the safe scene on panic', () => {
    const { runtime, store, stage } = createTestRuntime();
    store.getState().apply({ demo: true, blackout: true });
    runFrames(runtime, 1.5);
    expect(lastDraw(stage).frame.intensity).toBeLessThan(0.01);

    store.getState().apply({ blackout: false, panic: true });
    runFrames(runtime, 1, 3);
    expect(lastDraw(stage).sceneId).toBe('ambient');
  });

  it('rotates scenes while music plays and writes the new selection to the store', () => {
    const { runtime, store } = createTestRuntime({ intervalSec: 2, rng: () => 0.5 });
    store.getState().apply({ demo: true });
    runFrames(runtime, 10);
    expect(store.getState().sceneId).not.toBe('tunnel');
  });

  it('publishes snapshots that can be sent to another window', () => {
    const { runtime, store } = createTestRuntime();
    const received: unknown[] = [];
    runtime.subscribe((snapshot) => received.push(snapshot));

    store.getState().apply({ paletteId: 'ice' });
    runFrames(runtime, 0.5);

    expect(received.length).toBeGreaterThan(1);
    const snapshot = runtime.getSnapshot();
    expect(snapshot.show.paletteId).toBe('ice');
    expect(snapshot.performance.resolution).toEqual([640, 360]);
    expect(() => structuredClone(snapshot)).not.toThrow(); // what postMessage requires
  });
});
