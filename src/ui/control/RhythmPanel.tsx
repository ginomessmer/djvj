import type { ShowSnapshot } from '@/domain/remote/protocol';
import type { ShowPatch, ShowState } from '@/domain/show/show-state';
import { Meter } from '../components/Meter';
import { Panel } from '../components/Panel';
import { Slider } from '../components/Slider';

interface RhythmPanelProps {
  rhythm: ShowSnapshot['rhythm'];
  show: ShowState;
  onPatch: (patch: ShowPatch) => void;
  onTap: () => void;
  onClearTap: () => void;
}

export function RhythmPanel({ rhythm, show, onPatch, onTap, onClearTap }: RhythmPanelProps) {
  const tapped = rhythm.source === 'tap';

  return (
    <Panel title="Rhythm" class="panel--rhythm">
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
          <span class="hint">Tap four times on the kick</span>
        )}
      </div>
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
    </Panel>
  );
}
