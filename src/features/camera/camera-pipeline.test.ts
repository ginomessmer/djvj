import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CameraInput } from '@/services/camera-input';
import { CameraPipeline } from './camera-pipeline';

const DEVICES = [
  { id: 'facetime', label: 'FaceTime HD Camera' },
  { id: 'iphone', label: 'DJ’s iPhone Camera' },
];

function fakeCamera(devices = DEVICES) {
  const input = {
    deviceId: '',
    onLost: null as (() => void) | null,
    video: null,
    ready: true,
    start: vi.fn(async (deviceId: string) => {
      input.deviceId = deviceId || 'facetime';
    }),
    stop: vi.fn(),
    listDevices: vi.fn(async () => devices),
  };
  return input;
}

const named = (name: string) => Object.assign(new Error(name), { name });

describe('CameraPipeline', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('switches to the iPhone once permission revealed the camera names', async () => {
    const input = fakeCamera();
    const camera = new CameraPipeline(input as unknown as CameraInput);
    await camera.start('');
    expect(input.start.mock.calls.map(([id]) => id)).toEqual(['', 'iphone']);
    expect(camera.status).toBe('running');
    expect(camera.activeDeviceId).toBe('iphone');
  });

  it('keeps the camera the DJ picked', async () => {
    const input = fakeCamera();
    const camera = new CameraPipeline(input as unknown as CameraInput);
    await camera.start('facetime');
    expect(input.start.mock.calls.map(([id]) => id)).toEqual(['facetime']);
    expect(camera.activeDeviceId).toBe('facetime');
  });

  it('reports a denied permission and does not keep asking', async () => {
    const input = fakeCamera();
    input.start.mockRejectedValue(named('NotAllowedError'));
    const camera = new CameraPipeline(input as unknown as CameraInput);
    await camera.start('');
    expect(camera.status).toBe('error');
    expect(camera.error).toMatch(/denied/);
    expect(camera.ready).toBe(false);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(input.start).toHaveBeenCalledTimes(1);
  });

  it('retries a lost camera until it is back', async () => {
    const input = fakeCamera();
    const camera = new CameraPipeline(input as unknown as CameraInput);
    await camera.start('iphone');
    input.start.mockRejectedValueOnce(named('NotFoundError'));
    input.onLost?.();
    expect(camera.status).toBe('error');
    expect(camera.video).toBeNull();
    await vi.advanceTimersByTimeAsync(2100);
    expect(camera.status).toBe('error'); // still gone
    await vi.advanceTimersByTimeAsync(2100);
    expect(camera.status).toBe('running');
    expect(input.start).toHaveBeenLastCalledWith('iphone');
  });

  it('stops retrying once turned off', async () => {
    const input = fakeCamera();
    const camera = new CameraPipeline(input as unknown as CameraInput);
    await camera.start('iphone');
    input.onLost?.();
    camera.stop();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(input.start).toHaveBeenCalledTimes(1);
    expect(camera.status).toBe('off');
  });

  it('lets the newest start win', async () => {
    const input = fakeCamera();
    let release!: () => void;
    input.start.mockImplementationOnce(
      (deviceId: string) =>
        new Promise<void>((resolve) => {
          release = () => {
            input.deviceId = deviceId;
            resolve();
          };
        }),
    );
    const camera = new CameraPipeline(input as unknown as CameraInput);
    const first = camera.start('facetime');
    camera.stop();
    release();
    await first;
    expect(camera.status).toBe('off');
  });
});
