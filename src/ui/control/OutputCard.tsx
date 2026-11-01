import type { ShowSnapshot } from '@/domain/remote/protocol';
import type { ShowPatch, ShowState } from '@/domain/show/show-state';
import { Card } from '../components/Card';
import { Slider } from '../components/Slider';

interface OutputCardProps {
  show: ShowState;
  performance: ShowSnapshot['performance'];
  onPatch: (patch: ShowPatch) => void;
}

export function OutputCard({ show, performance, onPatch }: OutputCardProps) {
  const [width, height] = performance.resolution;

  return (
    <Card title="Output">
      <Slider
        label="Brightness"
        value={show.intensity}
        min={0}
        max={1}
        step={0.01}
        onInput={(intensity) => onPatch({ intensity })}
      />
      <Slider
        label="Resolution budget"
        value={show.renderScale}
        min={0.25}
        max={2}
        step={0.05}
        format={(scale) => `${scale.toFixed(2)}× 1080p`}
        onInput={(renderScale) => onPatch({ renderScale })}
      />
      <div class="row">
        <button
          type="button"
          class={show.blackout ? 'active' : ''}
          onClick={() => onPatch({ blackout: !show.blackout })}
        >
          Blackout (B)
        </button>
        <button
          type="button"
          class={show.panic ? 'danger active' : 'danger'}
          onClick={() => onPatch({ panic: !show.panic })}
        >
          Panic (P)
        </button>
      </div>
      <p class="muted">
        {performance.fps.toFixed(0)} fps · {performance.frameMs.toFixed(1)} ms/frame · {width}×
        {height} px
      </p>
    </Card>
  );
}
