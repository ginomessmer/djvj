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

  it('changes scene on the beat grid while music plays and writes it to the store', () => {
    const { runtime, store } = createTestRuntime({ phraseBeats: 8, rng: () => 0.5 });
    store.getState().apply({ demo: true });
    runFrames(runtime, 20);
    expect(store.getState().sceneId).not.toBe('tunnel');
  });

  it('finds the tempo and the groove of the demo music', () => {
    const { runtime, store } = createTestRuntime();
    store.getState().apply({ demo: true });
    runFrames(runtime, 12);
    const { rhythm } = runtime.getSnapshot();
    expect(Math.abs(rhythm.bpm - 128)).toBeLessThan(1);
    expect(rhythm.confidence).toBeGreaterThan(0.5);
    expect(rhythm.section).toBe('groove');
  });

  it('follows the demo into its breakdown and cuts to a peak scene on the drop', () => {
    const { runtime, store, stage } = createTestRuntime();
    store.getState().apply({ demo: true });
    const sections: string[] = [];
    let t = 1;
    while (t < 59.5) {
      t = runFrames(runtime, 0.25, t);
      const { section } = runtime.getSnapshot().rhythm;
      if (sections.at(-1) !== section) sections.push(section);
    }
    expect(sections).toEqual(['groove', 'breakdown', 'build']);

    runFrames(runtime, 60.5 - t, t); // the demo drops at 60 s
    const { sceneId, frame } = lastDraw(stage);
    expect(runtime.getSnapshot().rhythm.section).toBe('drop');
    expect(['tunnel', 'starfield', 'lasers']).toContain(sceneId);
    expect(frame.intensity).toBeGreaterThan(0.9); // a cut, not a fade
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
