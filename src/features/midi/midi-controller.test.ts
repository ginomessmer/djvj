import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShowStore } from '../show/show-store';
import { fakeMidiInput, memoryStorage } from '../test-utils';
import { MidiController } from './midi-controller';

afterEach(() => vi.unstubAllGlobals());

const PAD_PRESS = [0x97, 36, 127];
const PAD_RELEASE = [0x97, 36, 0];

function setup(options: Parameters<typeof fakeMidiInput>[0] = {}) {
  vi.stubGlobal('localStorage', memoryStorage());
  const store = createShowStore();
  const fake = fakeMidiInput(options);
  const midi = new MidiController(fake.input, store);
  const onTap = vi.fn();
  const onClearTap = vi.fn();
  const onChange = vi.fn();
  Object.assign(midi, { onTap, onClearTap, onChange });
  midi.start();
  const enable = async () => {
    store.getState().apply({ midiEnabled: true });
    await vi.waitFor(() => expect(midi.state.status).not.toBe('pending'));
  };
  return { store, fake, midi, onTap, onClearTap, onChange, enable };
}

describe('MidiController', () => {
  it('stays off, and asks for nothing, until MIDI is enabled', () => {
    const { midi, fake } = setup();
    expect(midi.state.status).toBe('off');
    expect(fake.input.open).not.toHaveBeenCalled();
  });

  it('connects when enabled and lists the controllers', async () => {
    const { midi, enable } = setup();
    await enable();
    expect(midi.state).toMatchObject({ status: 'on', devices: ['DDJ-FLX10'] });
  });

  it('reports a denied permission and a browser without Web MIDI', async () => {
    const denied = setup({ error: Object.assign(new Error('no'), { name: 'NotAllowedError' }) });
    await denied.enable();
    expect(denied.midi.state.status).toBe('denied');

    const unsupported = setup({ supported: false });
    await unsupported.enable();
    expect(unsupported.midi.state.status).toBe('unsupported');
  });

  it('stops listening when disabled', async () => {
    const { store, midi, fake, enable } = setup();
    await enable();
    store.getState().apply({ midiEnabled: false });
    expect(fake.connection.close).toHaveBeenCalled();
    expect(midi.state.status).toBe('off');
  });

  it('learns a pad, stores the binding and does not fire on the teaching press', async () => {
    const { store, midi, fake, enable } = setup();
    await enable();
    midi.learn('panic');
    expect(midi.state.learning).toBe('panic');
    fake.send(PAD_PRESS);
    expect(store.getState().midiBindings).toEqual({
      panic: { kind: 'note', channel: 7, number: 36 },
    });
    expect(midi.state.learning).toBeNull();
    expect(store.getState().panic).toBe(false);
    expect(
      JSON.parse(localStorage.getItem('djvj.show') ?? '{}').state.midiBindings.panic,
    ).toBeDefined();
  });

  it('runs show commands from bound pads', async () => {
    const { store, midi, fake, enable } = setup();
    await enable();
    midi.learn('panic');
    fake.send(PAD_PRESS);
    fake.send(PAD_RELEASE);

    fake.send(PAD_PRESS);
    expect(store.getState().panic).toBe(true);
    fake.send(PAD_RELEASE);
    fake.send(PAD_PRESS);
    expect(store.getState().panic).toBe(false);
  });

  it('times taps by when the message arrived, not when it is handled', async () => {
    const { store, fake, onTap, onClearTap, enable } = setup();
    await enable();
    store.getState().apply({
      midiBindings: {
        tap: { kind: 'note', channel: 0, number: 1 },
        'clear-tap': { kind: 'note', channel: 0, number: 2 },
      },
    });
    fake.send([0x90, 1, 127], 12_345);
    expect(onTap).toHaveBeenCalledWith(12.345);
    fake.send([0x90, 2, 127]);
    expect(onClearTap).toHaveBeenCalled();
  });

  it('follows a knob bound to brightness', async () => {
    const { store, fake, enable } = setup();
    await enable();
    store
      .getState()
      .apply({ midiBindings: { brightness: { kind: 'cc', channel: 0, number: 19 } } });
    fake.send([0xb0, 19, 0]);
    expect(store.getState().intensity).toBe(0);
    fake.send([0xb0, 19, 127]);
    expect(store.getState().intensity).toBe(1);
  });

  it('shows the last message, to check what a control sends', async () => {
    const { midi, fake, enable } = setup();
    await enable();
    fake.send([0xb0, 19, 64]);
    expect(midi.state.lastEvent).toBe('CC 19 · ch 1 = 64');
  });

  it('does not learn while MIDI is off', () => {
    const { midi } = setup();
    midi.learn('panic');
    expect(midi.state.learning).toBeNull();
  });

  it('drops a permission answer that arrives after MIDI was switched off again', async () => {
    const { store, midi, fake } = setup();
    let grant: (() => void) | undefined;
    vi.mocked(fake.input.open).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          grant = () => resolve(fake.connection);
        }),
    );
    store.getState().apply({ midiEnabled: true });
    expect(midi.state.status).toBe('pending');
    store.getState().apply({ midiEnabled: false });
    grant?.();
    await vi.waitFor(() => expect(fake.connection.close).toHaveBeenCalled());
    expect(midi.state.status).toBe('off');
  });
});
