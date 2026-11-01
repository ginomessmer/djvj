import type { CameraDevice } from '@/domain/camera/camera-device';

/**
 * Asked for, not required: 720p at 30 fps is plenty behind effects, and a bigger frame only costs
 * upload bandwidth and GPU time next to rekordbox.
 */
const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  frameRate: { ideal: 30, max: 30 },
};

/**
 * Browser camera input: a built-in webcam, a USB camera, or an iPhone via Continuity Camera.
 * The frames go into a muted `<video>` element that the stage uploads as a texture. Nothing is
 * recorded or sent anywhere.
 */
export class CameraInput {
  /** Called when the active camera disappears (unplugged, iPhone taken away, revoked). */
  onLost: (() => void) | null = null;
  deviceId = '';

  private stream: MediaStream | null = null;
  private element: HTMLVideoElement | null = null;

  /** The playing video, or null while no camera is open. */
  get video(): HTMLVideoElement | null {
    return this.stream ? this.element : null;
  }

  /** True once frames arrive (a camera can take a moment, and an iPhone a bit longer). */
  get ready(): boolean {
    const video = this.video;
    return (
      !!video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0
    );
  }

  async start(deviceId = ''): Promise<void> {
    this.stop();
    const stream = await this.openStream(deviceId);
    const track = stream.getVideoTracks()[0];
    if (!track) {
      for (const t of stream.getTracks()) t.stop();
      throw new Error('The selected device has no video track.');
    }
    track.addEventListener('ended', () => {
      if (this.stream !== stream) return;
      this.stop();
      this.onLost?.();
    });

    const video = this.element ?? this.createElement();
    video.srcObject = stream;
    this.stream = stream;
    this.deviceId = track.getSettings().deviceId ?? deviceId;
    await video.play();
  }

  stop(): void {
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.stream = null;
    if (this.element) this.element.srcObject = null;
  }

  /** Labels only appear after the user granted camera permission once. */
  async listDevices(): Promise<CameraDevice[]> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((device) => device.kind === 'videoinput')
      .map((device, index) => ({
        id: device.deviceId,
        label: device.label || `Camera ${index + 1}`,
      }));
  }

  private async openStream(deviceId: string): Promise<MediaStream> {
    if (deviceId) {
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: { ...VIDEO_CONSTRAINTS, deviceId: { exact: deviceId } },
        });
      } catch (error) {
        const name = (error as { name?: string }).name;
        if (name !== 'OverconstrainedError' && name !== 'NotFoundError') throw error;
        console.warn(`[djvj] camera "${deviceId}" is gone, falling back to the default camera`);
      }
    }
    return navigator.mediaDevices.getUserMedia({ video: VIDEO_CONSTRAINTS });
  }

  /**
   * A tiny, invisible element in the page. Kept in the document, because browsers may stop
   * decoding (and stop announcing new frames for) a video that is not part of any page.
   */
  private createElement(): HTMLVideoElement {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('aria-hidden', 'true');
    Object.assign(video.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      width: '2px',
      height: '2px',
      opacity: '0',
      pointerEvents: 'none',
    });
    document.body.appendChild(video);
    this.element = video;
    return video;
  }
}
