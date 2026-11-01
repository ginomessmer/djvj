import type { AudioDevice, AudioStatus } from '@/domain/audio/audio-device';
import type { AudioFeatures } from '@/domain/audio/audio-features';
import { FeatureExtractor } from '@/domain/audio/feature-extractor';
import type { AudioInput } from '@/services/audio-input';

const RETRY_DELAY_MS = 2000;

function describeAudioError(error: unknown): string {
  switch ((error as { name?: string }).name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Microphone access was denied. Allow it via the lock icon in the address bar, then click again.';
    case 'NotFoundError':
      return 'No audio input device found.';
    case 'NotReadableError':
      return 'The audio input is busy or unavailable (used by another app?).';
    default:
      return error instanceof Error ? error.message : String(error);
  }
}

/**
 * Audio input plus analysis, with the failure handling a live show needs: errors become a status
 * message instead of a crash, and a lost device is retried until it comes back.
 */
export class AudioPipeline {
  status: AudioStatus = 'idle';
  error: string | null = null;
  devices: AudioDevice[] = [];
  /** Called after status, error or the device list changed. */
  onChange: (() => void) | null = null;

  private extractor: FeatureExtractor | null = null;
  private starting = false;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly input: AudioInput,
    private silenceDb: number,
  ) {
    input.onLost = () => this.handleLost();
  }

  get activeDeviceId(): string {
    return this.input.deviceId;
  }

  async start(deviceId: string): Promise<void> {
    if (this.starting) return;
    this.starting = true;
    try {
      await this.input.start(deviceId);
      this.extractor = new FeatureExtractor({
        sampleRate: this.input.sampleRate,
        binCount: this.input.binCount,
        silenceDb: this.silenceDb,
      });
      this.status = 'running';
      this.error = null;
    } catch (error) {
      this.status = 'error';
      this.error = describeAudioError(error);
    } finally {
      this.starting = false;
    }
    await this.refreshDevices();
  }

  async refreshDevices(): Promise<void> {
    try {
      this.devices = await this.input.listDevices();
    } catch {
      this.devices = [];
    }
    this.onChange?.();
  }

  setSilenceThreshold(silenceDb: number): void {
    this.silenceDb = silenceDb;
    this.extractor?.gate.setThreshold(silenceDb);
  }

  /** Features for this frame, or null while no input is running. */
  analyse(tSec: number): AudioFeatures | null {
    if (this.status !== 'running' || !this.extractor) return null;
    const sample = this.input.sample();
    return sample ? this.extractor.process(sample.spectrumDb, sample.rms, tSec) : null;
  }

  private handleLost(): void {
    this.status = 'error';
    this.error = 'Audio input lost, retrying…';
    this.onChange?.();
    this.scheduleRetry();
  }

  private scheduleRetry(): void {
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(async () => {
      await this.start(this.input.deviceId);
      if (this.status !== 'running') this.scheduleRetry();
    }, RETRY_DELAY_MS);
  }
}
