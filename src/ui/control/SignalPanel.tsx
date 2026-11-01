import { BAND_NAMES } from '@/domain/audio/bands';
import { clamp01 } from '@/domain/math';
import type { ShowSnapshot } from '@/domain/remote/protocol';
import { Led } from '../components/Led';
import { Panel } from '../components/Panel';

interface SignalPanelProps {
  signal: ShowSnapshot['signal'];
}

/** The narrow meter columns have no room for "high-mid". */
const SHORT_NAMES: Record<string, string> = { 'high-mid': 'hi-mid' };

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div class="bar">
      <div class="bar__track">
        <i class="bar__fill" style={{ transform: `scaleY(${clamp01(value).toFixed(3)})` }} />
      </div>
      <span class="bar__label">{SHORT_NAMES[label] ?? label}</span>
    </div>
  );
}

export function SignalPanel({ signal }: SignalPanelProps) {
  return (
    <Panel
      title="Signal"
      class="panel--signal"
      actions={
        <span class="panel__leds">
          <Led on={signal.present} label="signal" />
          <Led on={signal.kick > 0.5} label="kick" />
          <span class="panel__hint">{signal.loudnessDb.toFixed(0)} dBFS</span>
        </span>
      }
    >
      <div class="bars" role="img" aria-label={`Input level ${signal.loudnessDb.toFixed(0)} dBFS`}>
        {BAND_NAMES.map((name, band) => (
          <Bar key={name} label={name} value={signal.bands[band] ?? 0} />
        ))}
        <Bar label="energy" value={signal.energy} />
      </div>
    </Panel>
  );
}
