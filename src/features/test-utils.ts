import { vi } from 'vitest';
import type { PreviewFrame } from '@/domain/remote/preview';
import { Director, type DirectorOptions } from '@/domain/show/director';
import type { AudioInput } from '@/services/audio-input';
import type { MidiConnection, MidiInput, MidiMessageHandler } from '@/services/midi-input';
import type { LuminanceSample, Stage } from '@/vfx/stage';
import { AudioPipeline } from './audio/audio-pipeline';
import { MidiController } from './midi/midi-controller';
import { OutputRuntime } from './output/output-runtime';
import { createShowStore } from './show/show-store';

/** Minimal in-memory `localStorage`. */
export function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  };
}

export function fakeAudioInput(overrides: Partial<Record<keyof AudioInput, unknown>> = {}) {
  return {
    deviceId: 'mic',
    sampleRate: 48000,
    binCount: 1024,
    onLost: null,
    start: vi.fn().mockResolvedValue(undefined),
    sample: vi.fn(() => ({ spectrumDb: new Float32Array(1024).fill(-90), rms: 0.1 })),
    listDevices: vi.fn().mockResolvedValue([{ id: 'mic', label: 'Mic' }]),
    ...overrides,
  } as unknown as AudioInput;
}

/** A fake Web MIDI: `send` plays a message as if a controller sent it. */
export function fakeMidiInput(options: { supported?: boolean; error?: Error } = {}) {
  let handler: MidiMessageHandler | null = null;
  const connection: MidiConnection & { devices: string[] } = {
    devices: ['DDJ-FLX10'],
    onDevicesChange: null,
    close: vi.fn(() => {
      handler = null;
    }),
  };
  const input: MidiInput = {
    supported: options.supported ?? true,
    open: vi.fn(async (onMessage: MidiMessageHandler) => {
      if (options.error) throw options.error;
      handler = onMessage;
      return connection;
    }),
  };
  const send = (bytes: number[], timeStampMs = performance.now()) =>
    handler?.(Uint8Array.from(bytes), timeStampMs);
  return { input, connection, send, isOpen: () => handler !== null };
}

/** A runtime with a real store, director and pipeline, and a fake stage that records its draws. */
export function createTestRuntime(directorOptions: Partial<DirectorOptions> = {}) {
  vi.stubGlobal('localStorage', memoryStorage());
  const store = createShowStore();
  const stage = {
    resize: vi.fn((_budgetScale: number, _quality?: number): [number, number] => [640, 360]),
    render: vi.fn(),
    luminance: vi.fn((): LuminanceSample | null => null),
    setPreviewWanted: vi.fn(),
    takePreviewFrame: vi.fn((): PreviewFrame | null => null),
  };
  const logos: string[] = [];
  const logoStorage = { load: () => '', save: (url: string) => void logos.push(url) };
  const audio = new AudioPipeline(fakeAudioInput(), store.getState().silenceDb);
  const director = new Director(store.getState().sceneId, directorOptions);
  const fakeMidi = fakeMidiInput();
  const midi = new MidiController(fakeMidi.input, store);
  const runtime = new OutputRuntime({
    stage: stage as unknown as Stage,
    store,
    audio,
    director,
    logoStorage,
    midi,
  });
  return { runtime, store, stage, audio, logos, midi, fakeMidi };
}

/** Runs frames at 60 fps for `seconds`, starting at `startSec`. */
export function runFrames(runtime: OutputRuntime, seconds: number, startSec = 1): number {
  let t = startSec;
  for (let frame = 0; frame < seconds * 60; frame++) {
    runtime.renderFrame(t);
    t += 1 / 60;
  }
  return t;
}
