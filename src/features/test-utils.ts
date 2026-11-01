import { vi } from 'vitest';
import { Director } from '@/domain/show/director';
import type { SceneRotatorOptions } from '@/domain/show/scene-rotator';
import type { AudioInput } from '@/services/audio-input';
import type { Stage } from '@/vfx/stage';
import { AudioPipeline } from './audio/audio-pipeline';
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

/** A runtime with a real store, director and pipeline, and a fake stage that records its draws. */
export function createTestRuntime(rotation: Partial<SceneRotatorOptions> = {}) {
  vi.stubGlobal('localStorage', memoryStorage());
  const store = createShowStore();
  const stage = { resize: vi.fn(() => [640, 360]), render: vi.fn() };
  const audio = new AudioPipeline(fakeAudioInput(), store.getState().silenceDb);
  const director = new Director(store.getState().sceneId, rotation);
  const runtime = new OutputRuntime({ stage: stage as unknown as Stage, store, audio, director });
  return { runtime, store, stage, audio };
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
