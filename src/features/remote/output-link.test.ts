import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ControlMessage, OutputMessage } from '@/domain/remote/protocol';
import type { MessageBus } from '@/services/message-bus';
import { createTestRuntime } from '../test-utils';
import { linkOutputToBus } from './output-link';

afterEach(() => vi.unstubAllGlobals());

function setup() {
  const { runtime, store } = createTestRuntime();
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
  return { runtime, store, sent, receive: (message: ControlMessage) => receive(message), unlink };
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
    expect(last?.snapshot.show.blackout).toBe(true);
  });

  it('stops forwarding after unlink', () => {
    const { store, sent, unlink } = setup();
    unlink();
    store.getState().apply({ blackout: true });
    expect(sent).toHaveLength(0);
  });
});

describe('linkOutputToBus and MIDI learn', () => {
  it('starts and cancels MIDI learn, and ignores unknown actions', async () => {
    const { runtime, receive } = setup();
    const learn = vi.spyOn(runtime, 'learnMidi');
    receive({ type: 'midi-learn', action: 'panic' });
    receive({ type: 'midi-learn', action: null });
    receive({ type: 'midi-learn', action: 'format-disk' } as never);
    expect(learn.mock.calls).toEqual([['panic'], [null]]);
  });
});
