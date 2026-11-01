import type { ShowSnapshot } from '@/domain/remote/protocol';
import type { ShowPatch, ShowState } from '@/domain/show/show-state';
import { Disclosure } from '../components/Disclosure';
import { Led } from '../components/Led';
import { Toggle } from '../components/Toggle';

interface CameraPanelProps {
  camera: ShowSnapshot['camera'];
  show: ShowState;
  onPatch: (patch: ShowPatch) => void;
  onRefreshDevices: () => void;
}

function statusText(camera: ShowSnapshot['camera'], enabled: boolean): string {
  if (!enabled) return 'Off. Camera scenes are left out of the rotation.';
  switch (camera.status) {
    case 'running':
      return camera.ready
        ? 'Live. Camera scenes are part of the rotation.'
        : 'Opened, waiting for the first frames…';
    case 'starting':
      return 'Opening the camera… Allow access in the output window if it asks.';
    case 'error':
      return `⚠ ${camera.error ?? 'Camera error'}`;
    default:
      return 'Starting…';
  }
}

function summary(camera: ShowSnapshot['camera'], enabled: boolean): string {
  if (!enabled) return 'off';
  if (camera.ready) return 'live';
  return camera.status === 'error' ? 'problem' : 'starting';
}

export function CameraPanel({ camera, show, onPatch, onRefreshDevices }: CameraPanelProps) {
  const enabled = show.cameraEnabled;
  return (
    <Disclosure defaultOpen title="Camera" summary={summary(camera, enabled)}>
      <div class="row">
        <Toggle
          label="Use a camera"
          checked={enabled}
          onChange={(cameraEnabled) => onPatch({ cameraEnabled })}
        />
        <span class="row__end">
          <Led on={camera.ready} label="live" />
        </span>
      </div>
      {enabled && (
        <>
          <div class="row">
            <select
              aria-label="Camera"
              value={show.cameraDeviceId}
              onChange={(event) => onPatch({ cameraDeviceId: event.currentTarget.value })}
            >
              <option value="">Automatic (iPhone first)</option>
              {camera.devices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.label}
                </option>
              ))}
            </select>
            <button type="button" onClick={onRefreshDevices}>
              Refresh
            </button>
          </div>
          <Toggle
            label="Mirror (like a selfie)"
            checked={show.cameraMirror}
            onChange={(cameraMirror) => onPatch({ cameraMirror })}
          />
        </>
      )}
      <p class="hint" role="status">
        {statusText(camera, enabled)}
      </p>
      {enabled && (
        <p class="hint">
          Point it at yourself and the decks, with a small light on you. The image stays on this
          computer: it is never recorded or sent anywhere.
        </p>
      )}
    </Disclosure>
  );
}
