export type CameraStatus = 'off' | 'starting' | 'running' | 'error';

export interface CameraDevice {
  id: string;
  label: string;
}

/** An iPhone used as a webcam (macOS Continuity Camera), but not its Desk View camera. */
const CONTINUITY = /iphone|continuity/i;
const DESK_VIEW = /desk\s*view/i;

/**
 * The camera to use when the DJ has not picked one: an iPhone via Continuity Camera if there is
 * one (far better in a dark booth than a laptop webcam), otherwise null for the system default.
 * Labels are only known after camera permission was granted once.
 */
export function preferredCameraId(devices: readonly CameraDevice[]): string | null {
  return devices.find(({ label }) => CONTINUITY.test(label) && !DESK_VIEW.test(label))?.id ?? null;
}
