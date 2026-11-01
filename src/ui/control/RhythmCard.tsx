import type { ShowSnapshot } from '@/domain/remote/protocol';
import type { Section } from '@/domain/rhythm/section-tracker';
import type { ShowPatch, ShowState } from '@/domain/show/show-state';
import { Card } from '../components/Card';
import { Led } from '../components/Led';
import { Meter } from '../components/Meter';
import { Slider } from '../components/Slider';

export const SECTION_LABELS: Record<Section, string> = {
  quiet: 'Quiet',
  groove: 'Groove',
  breakdown: 'Breakdown',
  build: 'Build-up',
  drop: 'Drop',
};

/** Below this confidence the tempo is not shown: it would only be a guess. */
const SHOW_BPM_FROM = 0.2;

interface RhythmCardProps {
  rhythm: ShowSnapshot['rhythm'];
  show: ShowState;
  onPatch: (patch: ShowPatch) => void;
  onTap: () => void;
  onClearTap: () => void;
}

export function RhythmCard({ rhythm, show, onPatch, onTap, onClearTap }: RhythmCardProps) {
  const known = rhythm.bpm > 0 && rhythm.confidence >= SHOW_BPM_FROM;
  const tapped = rhythm.source === 'tap';

  return (
    <Card title="Rhythm">
      <div class="row">
        <span class="bpm">
          {known ? rhythm.bpm.toFixed(1) : '–––'}
          <small> BPM{tapped && ' · tapped'}</small>
        </span>
        <Led on={known && rhythm.beatPhase < 0.25} label="beat" />
        <span class={`section-tag section-tag--${rhythm.section}`}>
          {SECTION_LABELS[rhythm.section]}
        </span>
      </div>
      <Meter label="lock" value={rhythm.confidence} />
      <div class="row">
        <button type="button" class="tap" onPointerDown={onTap}>
          Tap (T)
        </button>
        {tapped && (
          <button type="button" onClick={onClearTap}>
            Back to auto
          </button>
        )}
      </div>
      <p class="muted">
        Not locking? Tap four times on the kick: the tapped tempo stays until you go back to auto.
      </p>
      <Slider
        label="Beat offset"
        value={show.beatOffsetMs}
        min={-150}
        max={150}
        step={5}
        format={(ms) => `${ms > 0 ? '+' : ''}${ms} ms`}
        onInput={(beatOffsetMs) => onPatch({ beatOffsetMs })}
      />
      <p class="muted">
        Visuals late on the big screen? Move the offset right until the pulse sits on the kick.
      </p>
    </Card>
  );
}
