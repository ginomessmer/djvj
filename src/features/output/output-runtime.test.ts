import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestRuntime, runFrames } from '../test-utils';

afterEach(() => vi.unstubAllGlobals());

/** Arguments of the most recent `stage.render` call: the scene mix, frame and overlay. */
function lastDraw(stage: { render: ReturnType<typeof vi.fn> }) {
  const [mix, frame, overlay] = stage.render.mock.calls.at(-1) ?? [];
  return { sceneId: mix?.toId, mix, frame, overlay };
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

  it('crossfades between two scenes when the director moves on', () => {
    const { runtime, store, stage } = createTestRuntime({ phraseBeats: 8, rng: () => 0.5 });
    store.getState().apply({ demo: true });
    runFrames(runtime, 20);
    const blends = stage.render.mock.calls.filter(([mix]) => mix.mix > 0.2 && mix.mix < 0.8);
    expect(blends.length).toBeGreaterThan(0);
    expect(blends.every(([mix]) => mix.fromId !== mix.toId)).toBe(true);
  });

  it('brings a new palette on the drop in auto palette mode, and keeps a locked one', () => {
    for (const autoPalette of [true, false]) {
      const { runtime, store } = createTestRuntime();
      store.getState().apply({ demo: true, autoPalette, paletteId: 'synthwave' });
      runFrames(runtime, 58.5); // from 1 s to 59.5 s: the demo drops at 60 s
      const before = store.getState().paletteId;
      runFrames(runtime, 1, 59.5);
      const changed = store.getState().paletteId !== before;
      expect(changed).toBe(autoPalette);
    }
  });

  it('damps the pulse and dims a little when the output flashes', () => {
    const { runtime, store, stage } = createTestRuntime();
    store.getState().apply({ demo: true });
    runFrames(runtime, 10);
    const calmPulse = Math.max(
      ...stage.render.mock.calls.slice(-60).map(([, frame]) => frame.rhythm.pulse),
    );

    let frame = 0;
    stage.luminance.mockImplementation(() => ({
      tSec: 11 + frame / 60,
      value: frame++ % 8 < 4 ? 0.1 : 0.6,
    }));
    runFrames(runtime, 2, 11);
    const guarded = stage.render.mock.calls.slice(-60).map(([, frameParams]) => frameParams);
    expect(runtime.getSnapshot().safety.flashGuard).toBe(1);
    expect(Math.max(...guarded.map((f) => f.rhythm.pulse))).toBeLessThan(0.2 * calmPulse);
    expect(guarded.at(-1)?.intensity).toBeLessThan(0.8);
  });

  it('lowers the resolution when frames get slow, unless switched off', () => {
    for (const adaptiveResolution of [true, false]) {
      const { runtime, store, stage } = createTestRuntime();
      store.getState().apply({ adaptiveResolution });
      for (let t = 1; t < 6; t += 1 / 30) runtime.renderFrame(t); // 30 fps
      const quality = stage.resize.mock.calls.at(-1)?.[1];
      if (adaptiveResolution) expect(quality).toBeLessThan(0.7);
      else expect(quality).toBe(1);
    }
  });

  it('shows the overlay when there is something to show', () => {
    const { runtime, store, stage } = createTestRuntime();
    store.getState().apply({ overlayMode: 'corner' });
    runFrames(runtime, 3);
    expect(lastDraw(stage).overlay.opacity).toBe(0); // no name, no logo

    store.getState().apply({ overlayName: 'DJ Test' });
    runFrames(runtime, 3, 4);
    expect(lastDraw(stage).overlay).toMatchObject({ name: 'DJ Test', layout: 'corner' });
    expect(lastDraw(stage).overlay.opacity).toBeGreaterThan(0.5);
  });

  it('stores a valid logo, keeps it out of the snapshot and ignores anything else', () => {
    const { runtime, logos } = createTestRuntime();
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    runtime.setLogo(png);
    runtime.setLogo('javascript:alert(1)');
    runtime.setLogo(`data:image/png;base64,${'A'.repeat(3_000_001)}`);
    expect(logos).toEqual([png]);
    const snapshot = runtime.getSnapshot();
    expect(snapshot.overlay.hasLogo).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain('iVBORw0KGgo');
  });

  it('takes a tapped tempo', () => {
    const { runtime } = createTestRuntime();
    runFrames(runtime, 1);
    for (let i = 0; i < 4; i++) runtime.tap(2 + i * (60 / 140));
    runFrames(runtime, 2, 4);
    const { rhythm } = runtime.getSnapshot();
    expect(rhythm.source).toBe('tap');
    expect(Math.abs(rhythm.bpm - 140)).toBeLessThan(0.5);
    runtime.clearTap();
    expect(runtime.getSnapshot().rhythm.source).toBe('tap'); // until the next frame
    runFrames(runtime, 0.1, 6);
    expect(runtime.getSnapshot().rhythm.source).toBe('auto');
  });

  it('takes the tempo from a MIDI pad, timed when the pad was hit', async () => {
    const { runtime, store, midi, fakeMidi } = createTestRuntime();
    midi.start();
    store.getState().apply({
      midiEnabled: true,
      midiBindings: { tap: { kind: 'note', channel: 0, number: 1 } },
    });
    await vi.waitFor(() => expect(runtime.getSnapshot().midi.status).toBe('on'));
    runFrames(runtime, 1);
    for (let i = 0; i < 4; i++) {
      fakeMidi.send([0x90, 1, 127], (2 + i * (60 / 140)) * 1000);
      fakeMidi.send([0x90, 1, 0]);
    }
    runFrames(runtime, 2, 4);
    const { rhythm } = runtime.getSnapshot();
    expect(rhythm.source).toBe('tap');
    expect(Math.abs(rhythm.bpm - 140)).toBeLessThan(0.5);
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
