import { vi } from 'vitest';
import type { PreviewFrame } from '@/domain/remote/preview';
import { Director, type DirectorOptions } from '@/domain/show/director';
import type { AudioInput } from '@/services/audio-input';
import type { CameraInput } from '@/services/camera-input';
import type { LuminanceSample, Stage } from '@/vfx/stage';
import { AudioPipeline } from './audio/audio-pipeline';
import { CameraPipeline } from './camera/camera-pipeline';
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

/** A camera that opens at once and delivers frames into a stand-in video element. */
export function fakeCameraInput() {
  const video = { readyState: 4, videoWidth: 1280, videoHeight: 720 } as HTMLVideoElement;
  const input = {
    deviceId: '',
    onLost: null as (() => void) | null,
    open: false,
    get video() {
      return input.open ? video : null;
    },
    get ready() {
      return input.open;
    },
    start: vi.fn(async (deviceId: string) => {
      input.deviceId = deviceId || 'webcam';
      input.open = true;
    }),
    stop: vi.fn(() => {
      input.open = false;
    }),
    listDevices: vi.fn().mockResolvedValue([{ id: 'webcam', label: 'FaceTime HD Camera' }]),
  };
  return input;
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
  const cameraInput = fakeCameraInput();
  const camera = new CameraPipeline(cameraInput as unknown as CameraInput);
  const director = new Director(store.getState().sceneId, directorOptions);
  const runtime = new OutputRuntime({
    stage: stage as unknown as Stage,
    store,
    audio,
    camera,
    director,
    logoStorage,
  });
  return { runtime, store, stage, audio, camera, cameraInput, logos };
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
