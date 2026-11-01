import { BAND_NAMES } from '@/domain/audio/bands';
import { clamp01 } from '@/domain/math';
import type { ShowSnapshot } from '@/domain/remote/protocol';
import { Card } from '../components/Card';
import { Led } from '../components/Led';

interface SignalCardProps {
  signal: ShowSnapshot['signal'];
}

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div class="bar">
      <div class="bar__track">
        <i class="bar__fill" style={{ transform: `scaleY(${clamp01(value).toFixed(3)})` }} />
      </div>
      <span class="bar__label">{label}</span>
    </div>
  );
}

export function SignalCard({ signal }: SignalCardProps) {
  return (
    <Card title="Signal" class="card--signal">
      <div class="bars" role="img" aria-label={`Input level ${signal.loudnessDb.toFixed(0)} dBFS`}>
        {BAND_NAMES.map((name, band) => (
          <Bar key={name} label={name} value={signal.bands[band] ?? 0} />
        ))}
        <Bar label="energy" value={signal.energy} />
      </div>
      <div class="row">
        <Led on={signal.present} label="signal" />
        <Led on={signal.kick > 0.5} label="kick" />
        <span class="hint row__end">{signal.loudnessDb.toFixed(0)} dBFS</span>
      </div>
    </Card>
  );
}
