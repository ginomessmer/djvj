import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AudioInput } from '@/services/audio-input';
import { fakeAudioInput } from '../test-utils';
import { AudioPipeline } from './audio-pipeline';

afterEach(() => vi.useRealTimers());

describe('AudioPipeline', () => {
  it('starts, lists devices and analyses', async () => {
    const pipeline = new AudioPipeline(fakeAudioInput(), -52);
    const onChange = vi.fn();
    pipeline.onChange = onChange;
    expect(pipeline.analyse(0)).toBeNull(); // nothing before the first start

    await pipeline.start('mic');

    expect(pipeline.status).toBe('running');
    expect(pipeline.devices).toEqual([{ id: 'mic', label: 'Mic' }]);
    expect(onChange).toHaveBeenCalled();
    expect(pipeline.analyse(0)?.bands).toHaveLength(5);
  });

  it('turns a denied permission into a readable message instead of throwing', async () => {
    const input = fakeAudioInput({ start: vi.fn().mockRejectedValue({ name: 'NotAllowedError' }) });
    const pipeline = new AudioPipeline(input, -52);

    await pipeline.start('');

    expect(pipeline.status).toBe('error');
    expect(pipeline.error).toMatch(/denied/i);
    expect(pipeline.analyse(0)).toBeNull();
  });

  it('retries after the device is lost until it comes back', async () => {
    vi.useFakeTimers();
    const start = vi.fn().mockResolvedValue(undefined);
    const input = fakeAudioInput({ start });
    const pipeline = new AudioPipeline(input, -52);
    await pipeline.start('mic');

    start.mockRejectedValueOnce({ name: 'NotFoundError' });
    (input as AudioInput).onLost?.();
    expect(pipeline.status).toBe('error');
    expect(pipeline.error).toMatch(/retrying/i);

    await vi.advanceTimersByTimeAsync(2000); // first retry fails
    expect(pipeline.status).toBe('error');
    await vi.advanceTimersByTimeAsync(2000); // second retry succeeds
    expect(pipeline.status).toBe('running');
  });

  it('applies a changed silence threshold to the running analysis', async () => {
    const pipeline = new AudioPipeline(fakeAudioInput(), -52);
    await pipeline.start('mic');
    pipeline.setSilenceThreshold(-10); // the fake input is at -20 dBFS: now below the threshold
    let signal = false;
    for (let frame = 0; frame < 120; frame++)
      signal = pipeline.analyse(frame / 60)?.signal ?? false;
    expect(signal).toBe(false);
  });
});
