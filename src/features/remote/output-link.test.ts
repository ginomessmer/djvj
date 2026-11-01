import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ControlMessage, OutputMessage } from '@/domain/remote/protocol';
import type { MessageBus } from '@/services/message-bus';
import { createTestRuntime } from '../test-utils';
import { linkOutputToBus } from './output-link';

afterEach(() => vi.unstubAllGlobals());

function setup() {
  const { runtime, store, stage } = createTestRuntime();
  let receive: (message: ControlMessage) => void = () => undefined;
  const sent: OutputMessage[] = [];
  const bus: MessageBus<OutputMessage, ControlMessage> = {
    send: (message) => void sent.push(message),
    subscribe: (handler) => {
      receive = handler;
      return () => undefined;
    },
    close: () => undefined,
  };
  const unlink = linkOutputToBus(runtime, store, bus);
  return {
    runtime,
    store,
    stage,
    sent,
    receive: (message: ControlMessage) => receive(message),
    unlink,
  };
}

describe('linkOutputToBus', () => {
  it('answers hello with a snapshot', () => {
    const { sent, receive } = setup();
    receive({ type: 'hello' });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.type).toBe('snapshot');
  });

  it('applies valid patches from the control window', () => {
    const { store, receive } = setup();
    receive({ type: 'patch', patch: { paletteId: 'acid', auto: false } });
    expect(store.getState()).toMatchObject({ paletteId: 'acid', auto: false });
  });

  it('ignores invalid patches', () => {
    const { store, receive } = setup();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    receive({ type: 'patch', patch: { intensity: 99 } });
    expect(store.getState().intensity).toBe(1);
  });

  it('forwards state changes as snapshots', () => {
    const { store, sent } = setup();
    store.getState().apply({ blackout: true });
    const last = sent.at(-1);
    expect(last?.type === 'snapshot' && last.snapshot.show.blackout).toBe(true);
  });

  it('keeps the preview going while the control window asks for it, and forwards the frames', () => {
    const { runtime, stage, receive, sent } = setup();
    const frame = { width: 1, height: 1, pixels: new Uint8ClampedArray(4) };
    stage.takePreviewFrame.mockReturnValue(frame);

    runtime.renderFrame(performance.now() / 1000);
    expect(sent.filter((m) => m.type === 'frame')).toHaveLength(0);

    receive({ type: 'watch-preview' });
    runtime.renderFrame(performance.now() / 1000 + 0.5);
    expect(sent.filter((m) => m.type === 'frame')).toEqual([{ type: 'frame', frame }]);
  });

  it('stops forwarding after unlink', () => {
    const { store, sent, unlink } = setup();
    unlink();
    store.getState().apply({ blackout: true });
    expect(sent).toHaveLength(0);
  });
});
