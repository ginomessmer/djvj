import type { ShowSnapshot } from '@/domain/remote/protocol';
import type { ShowPatch, ShowState } from '@/domain/show/show-state';
import { Card } from '../components/Card';
import { Slider } from '../components/Slider';
import { Toggle } from '../components/Toggle';

interface AudioInputCardProps {
  audio: ShowSnapshot['audio'];
  show: ShowState;
  onPatch: (patch: ShowPatch) => void;
  onRefreshDevices: () => void;
}

function statusText({ status, error }: ShowSnapshot['audio']): string {
  if (status === 'running') return 'Listening.';
  if (status === 'error') return `⚠ ${error ?? 'Audio error'}`;
  return 'Not started: click the output window once to allow audio.';
}

export function AudioInputCard({ audio, show, onPatch, onRefreshDevices }: AudioInputCardProps) {
  return (
    <Card title="Audio input">
      <div class="row">
        <select
          aria-label="Audio input device"
          value={show.deviceId}
          onChange={(event) => onPatch({ deviceId: event.currentTarget.value })}
        >
          {audio.devices.length === 0 && (
            <option value="">(start audio in the output window)</option>
          )}
          {audio.devices.map((device) => (
            <option key={device.id} value={device.id}>
              {device.label}
            </option>
          ))}
        </select>
        <button type="button" onClick={onRefreshDevices}>
          Refresh
        </button>
      </div>
      <p class="muted">{statusText(audio)}</p>
      <Slider
        label="Silence threshold"
        value={show.silenceDb}
        min={-80}
        max={-20}
        step={1}
        format={(db) => `${db} dB`}
        onInput={(silenceDb) => onPatch({ silenceDb })}
      />
      <Toggle
        label="Demo signal (simulated 128 BPM, no audio needed)"
        checked={show.demo}
        onChange={(demo) => onPatch({ demo })}
      />
    </Card>
  );
}
