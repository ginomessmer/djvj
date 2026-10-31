import { BAND_NAMES } from '@/domain/audio/bands';
import type { ShowSnapshot } from '@/domain/remote/protocol';
import { Card } from '../components/Card';
import { Led } from '../components/Led';
import { Meter } from '../components/Meter';

interface SignalCardProps {
  signal: ShowSnapshot['signal'];
}

export function SignalCard({ signal }: SignalCardProps) {
  return (
    <Card title="Signal">
      {BAND_NAMES.map((name, band) => (
        <Meter key={name} label={name} value={signal.bands[band] ?? 0} />
      ))}
      <Meter label="energy" value={signal.energy} />
      <div class="row">
        <Led on={signal.present} label="signal" />
        <Led on={signal.kick > 0.5} label="kick" />
        <span class="muted row__end">{signal.loudnessDb.toFixed(0)} dBFS</span>
      </div>
    </Card>
  );
}
