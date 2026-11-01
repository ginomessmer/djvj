import {
  type CameraDevice,
  type CameraStatus,
  preferredCameraId,
} from '@/domain/camera/camera-device';
import type { CameraInput } from '@/services/camera-input';

const RETRY_DELAY_MS = 2000;
/** Worth trying again: the camera may turn up (an iPhone waking up) or be released by an app. */
const RETRYABLE = new Set(['NotFoundError', 'NotReadableError', 'AbortError']);

function describeCameraError(error: unknown): string {
  switch ((error as { name?: string }).name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera access was denied. Allow it via the lock icon in the output window’s address bar.';
    case 'NotFoundError':
      return 'No camera found. For an iPhone: same Apple ID, Wi-Fi and Bluetooth on, phone locked and held still.';
    case 'NotReadableError':
      return 'The camera is busy (used by another app?).';
    default:
      return error instanceof Error ? error.message : String(error);
  }
}

/**
 * The camera, with the failure handling a live show needs: errors become a status message, a
 * lost camera (an iPhone that dropped off Continuity) is retried until it comes back, and with no
 * camera picked an iPhone is preferred over the built-in webcam.
 */
export class CameraPipeline {
  status: CameraStatus = 'off';
  error: string | null = null;
  devices: CameraDevice[] = [];
  /** Called after status, error or the device list changed. */
  onChange: (() => void) | null = null;

  private wantedDeviceId = '';
  private generation = 0;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly input: CameraInput) {
    input.onLost = () => this.handleLost();
  }

  get activeDeviceId(): string {
    return this.status === 'running' ? this.input.deviceId : '';
  }

  get video(): HTMLVideoElement | null {
    return this.status === 'running' ? this.input.video : null;
  }

  /** Running and delivering frames. */
  get ready(): boolean {
    return this.status === 'running' && this.input.ready;
  }

  /** Opens `deviceId`, or with '' the preferred camera. A newer call wins over an older one. */
  async start(deviceId: string): Promise<void> {
    clearTimeout(this.retryTimer);
    const generation = ++this.generation;
    this.wantedDeviceId = deviceId;
    this.setStatus('starting', null);
    try {
      await this.input.start(deviceId || this.preferredId());
      if (generation !== this.generation) return;
      this.setStatus('running', null);
    } catch (error) {
      if (generation !== this.generation) return;
      this.input.stop();
      this.setStatus('error', describeCameraError(error));
      if (RETRYABLE.has((error as { name?: string }).name ?? '')) this.scheduleRetry();
    }
    await this.refreshDevices();
    // Labels (and so the iPhone) are only known once permission was granted: switch to it now.
    const preferred = this.preferredId();
    if (
      generation === this.generation &&
      this.status === 'running' &&
      !deviceId &&
      preferred &&
      preferred !== this.input.deviceId
    ) {
      await this.start('');
    }
  }

  stop(): void {
    clearTimeout(this.retryTimer);
    this.generation++;
    this.input.stop();
    this.setStatus('off', null);
  }

  async refreshDevices(): Promise<void> {
    try {
      this.devices = await this.input.listDevices();
    } catch {
      this.devices = [];
    }
    this.onChange?.();
  }

  private preferredId(): string {
    return preferredCameraId(this.devices) ?? '';
  }

  private setStatus(status: CameraStatus, error: string | null): void {
    this.status = status;
    this.error = error;
    this.onChange?.();
  }

  private handleLost(): void {
    this.setStatus('error', 'Camera lost, retrying…');
    this.scheduleRetry();
  }

  private scheduleRetry(): void {
    clearTimeout(this.retryTimer);
    const generation = this.generation;
    this.retryTimer = setTimeout(async () => {
      if (generation !== this.generation) return; // stopped or restarted meanwhile
      await this.start(this.wantedDeviceId); // schedules the next try itself if it fails again
    }, RETRY_DELAY_MS);
  }
}
