import { afterEach, describe, expect, it, vi } from 'vitest';
import { sceneTextStyle } from '@/domain/show/scenes';
import { createTestRuntime, runFrames } from '../test-utils';

afterEach(() => vi.unstubAllGlobals());

/** Arguments of the most recent `stage.render` call: the scene mix, frame and text. */
function lastDraw(stage: { render: ReturnType<typeof vi.fn> }) {
  const [mix, frame, text] = stage.render.mock.calls.at(-1) ?? [];
  return { sceneId: mix?.toId, mix, frame, text };
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

  it('slams a drop text in on the demo drop, in the style of the scene it cuts to', () => {
    const { runtime, store, stage } = createTestRuntime();
    store.getState().apply({
      demo: true,
      texts: [
        { text: 'make some noise', cue: 'drop' },
        { text: 'ready?', cue: 'build' },
      ],
    });
    let t = runFrames(runtime, 57); // into the demo's build-up (from 55 s)
    expect(runtime.getSnapshot().text.showing?.toUpperCase()).toBe('READY?');
    t = runFrames(runtime, 60.5 - t, t); // the demo drops at 60 s

    const { text, sceneId } = lastDraw(stage);
    expect(text.content).toEqual({ kind: 'text', text: 'make some noise' });
    expect(text.style).toBe(sceneTextStyle(sceneId));
    expect(text.look.opacity).toBe(1);
    expect(text.look.lift).toHaveLength('MAKE SOME NOISE'.length);
    expect(runtime.getSnapshot().text).toMatchObject({ style: text.style });
  });

  it('shows a text fired by hand, and hides texts while they are switched off', () => {
    const { runtime, store, stage } = createTestRuntime();
    store.getState().apply({ texts: [{ text: 'BACK IN 5', cue: 'groove' }] });
    runtime.showText(0);
    runtime.showText(-1); // ignored
    runFrames(runtime, 2);
    expect(lastDraw(stage).text.content).toEqual({ kind: 'text', text: 'BACK IN 5' });
    expect(runtime.getSnapshot().text.showing).toBe('BACK IN 5');

    store.getState().apply({ textsOn: false });
    runFrames(runtime, 2, 3);
    expect(lastDraw(stage).text.content).toBeNull();
    expect(runtime.getSnapshot().text.showing).toBeNull();
  });

  it('stores a valid image, draws it as an entry, and keeps it out of the snapshot', () => {
    const { runtime, store, stage, stored } = createTestRuntime();
    const webp = 'data:image/webp;base64,UklGRhoAAABXRUJQ';
    runtime.setImage('logo-1', webp);
    runtime.setImage('../escape', webp);
    runtime.setImage('logo-2', 'javascript:alert(1)');
    runtime.setImage('logo-3', `data:image/png;base64,${'A'.repeat(3_000_001)}`);
    expect([...stored.keys()]).toEqual(['logo-1']);

    store.getState().apply({ texts: [{ text: 'my logo', cue: 'drop', imageId: 'logo-1' }] });
    runtime.showText(0);
    runFrames(runtime, 1);
    expect(lastDraw(stage).text).toMatchObject({
      content: { kind: 'image', imageId: 'logo-1' },
      imageUrl: webp,
    });
    const snapshot = runtime.getSnapshot();
    expect(snapshot.images).toEqual(['logo-1']);
    expect(snapshot.text).toMatchObject({ showing: 'my logo', kind: 'image' });
    expect(JSON.stringify(snapshot)).not.toContain('UklGR');
  });

  it('forgets an image once no entry refers to it', () => {
    const { runtime, store, stored } = createTestRuntime();
    runtime.setImage('a', 'data:image/webp;base64,AAAA');
    store.getState().apply({ texts: [{ text: 'a', cue: 'drop', imageId: 'a' }] });
    expect(stored.has('a')).toBe(true);
    store.getState().apply({ texts: [] });
    expect(stored.has('a')).toBe(false);
    expect(runtime.getSnapshot().images).toEqual([]);
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

  describe('camera', () => {
    it('stays off until turned on, then opens and hands the video to the stage', async () => {
      const { runtime, store, stage, cameraInput } = createTestRuntime();
      runFrames(runtime, 0.2);
      expect(cameraInput.start).not.toHaveBeenCalled();
      expect(lastDraw(stage).frame.camera.video).toBeNull();

      store.getState().apply({ cameraEnabled: true, cameraMirror: true });
      await vi.waitFor(() => expect(runtime.getSnapshot().camera.ready).toBe(true));
      runFrames(runtime, 0.2, 2);
      expect(lastDraw(stage).frame.camera).toEqual({ video: cameraInput.video, mirror: true });
      expect(runtime.getSnapshot().camera).toMatchObject({
        status: 'running',
        activeDeviceId: 'webcam',
      });

      store.getState().apply({ cameraEnabled: false });
      runFrames(runtime, 0.2, 3);
      expect(cameraInput.stop).toHaveBeenCalled();
      expect(lastDraw(stage).frame.camera.video).toBeNull();
      expect(runtime.getSnapshot().camera.status).toBe('off');
    });

    it('opens the camera the DJ picks', async () => {
      const { runtime, store, cameraInput } = createTestRuntime();
      store.getState().apply({ cameraEnabled: true });
      await vi.waitFor(() => expect(runtime.getSnapshot().camera.ready).toBe(true));
      store.getState().apply({ cameraDeviceId: 'usb' });
      await vi.waitFor(() => expect(runtime.getSnapshot().camera.activeDeviceId).toBe('usb'));
      expect(cameraInput.start).toHaveBeenLastCalledWith('usb');
    });

    it('rotates camera scenes in only while the camera runs', async () => {
      const cameraScenes = ['halftone', 'glyphs', 'neon', 'glitch'];
      const shown = async (cameraEnabled: boolean) => {
        let draw = 0;
        const { runtime, store, stage } = createTestRuntime({
          phraseBeats: 4,
          minBeatsBetweenChanges: 2,
          rng: () => (draw++ * 0.37) % 1,
        });
        store.getState().apply({ demo: true, cameraEnabled });
        if (cameraEnabled) {
          await vi.waitFor(() => expect(runtime.getSnapshot().camera.ready).toBe(true));
        }
        runFrames(runtime, 60);
        return new Set(stage.render.mock.calls.map(([mix]) => mix.toId as string));
      };
      const without = await shown(false);
      expect(cameraScenes.filter((id) => without.has(id))).toEqual([]);
      const withCamera = await shown(true);
      expect(cameraScenes.some((id) => withCamera.has(id))).toBe(true);
    });
  });

  describe('preview', () => {
    const frame = { width: 2, height: 2, pixels: new Uint8ClampedArray(16) };

    it('costs nothing until a control window is watching', () => {
      const { runtime, stage } = createTestRuntime();
      stage.takePreviewFrame.mockReturnValue(frame);
      const frames: unknown[] = [];
      runtime.subscribeFrames((f) => frames.push(f));
      runtime.renderFrame(1);
      expect(stage.setPreviewWanted).toHaveBeenLastCalledWith(false);
      expect(frames).toHaveLength(0);
    });

    it('sends frames while watched, at most ten per second, and stops when the watch lapses', () => {
      const { runtime, stage } = createTestRuntime();
      stage.takePreviewFrame.mockReturnValue(frame);
      const frames: unknown[] = [];
      runtime.subscribeFrames((f) => frames.push(f));

      runtime.watchPreview(1);
      runtime.renderFrame(1.01);
      expect(stage.setPreviewWanted).toHaveBeenLastCalledWith(true);
      expect(frames).toHaveLength(1);

      runtime.renderFrame(1.05); // too soon after the last one
      expect(frames).toHaveLength(1);
      runtime.renderFrame(1.2);
      expect(frames).toHaveLength(2);

      runtime.renderFrame(5); // nobody asked again for 3 s
      expect(stage.setPreviewWanted).toHaveBeenLastCalledWith(false);
      expect(frames).toHaveLength(2);
    });

    it('stops sending to a listener that unsubscribed', () => {
      const { runtime, stage } = createTestRuntime();
      stage.takePreviewFrame.mockReturnValue(frame);
      const frames: unknown[] = [];
      const stop = runtime.subscribeFrames((f) => frames.push(f));
      stop();
      runtime.watchPreview(1);
      runtime.renderFrame(1.01);
      expect(frames).toHaveLength(0);
      expect(stage.setPreviewWanted).toHaveBeenLastCalledWith(false);
    });
  });
});
