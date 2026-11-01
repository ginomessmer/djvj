import type { ShowSnapshot } from '@/domain/remote/protocol';
import type { ShowPatch, ShowState } from '@/domain/show/show-state';
import { Card } from '../components/Card';
import { Meter } from '../components/Meter';
import { Slider } from '../components/Slider';

interface RhythmCardProps {
  rhythm: ShowSnapshot['rhythm'];
  show: ShowState;
  onPatch: (patch: ShowPatch) => void;
  onTap: () => void;
  onClearTap: () => void;
}

export function RhythmCard({ rhythm, show, onPatch, onTap, onClearTap }: RhythmCardProps) {
  const tapped = rhythm.source === 'tap';

  return (
    <Card title="Rhythm" class="card--rhythm">
      <Meter label="Lock" value={rhythm.confidence} />
      <div class="row">
        {/* A press counts at once (pointerdown); `detail === 0` is a click from the keyboard. */}
        <button
          type="button"
          class="tap"
          aria-keyshortcuts="T"
          onPointerDown={onTap}
          onClick={(event) => event.detail === 0 && onTap()}
        >
          Tap <kbd>T</kbd>
        </button>
        {tapped ? (
          <button type="button" onClick={onClearTap}>
            Back to auto
          </button>
        ) : (
          <span class="hint">Not locking? Tap four times on the kick.</span>
        )}
      </div>
      {tapped && <p class="hint">Tapped tempo is held until you go back to auto.</p>}
      <Slider
        label="Beat offset"
        value={show.beatOffsetMs}
        min={-150}
        max={150}
        step={5}
        format={(ms) => `${ms > 0 ? '+' : ''}${ms} ms`}
        hint="Visuals late on the big screen? Move right until the pulse sits on the kick."
        onInput={(beatOffsetMs) => onPatch({ beatOffsetMs })}
      />
    </Card>
  );
}
