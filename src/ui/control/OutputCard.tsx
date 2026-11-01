import type { ShowSnapshot } from '@/domain/remote/protocol';
import type { ShowPatch, ShowState } from '@/domain/show/show-state';
import { Disclosure } from '../components/Disclosure';
import { Led } from '../components/Led';
import { Slider } from '../components/Slider';
import { Toggle } from '../components/Toggle';

interface OutputCardProps {
  show: ShowState;
  performance: ShowSnapshot['performance'];
  safety: ShowSnapshot['safety'];
  onPatch: (patch: ShowPatch) => void;
}

export function OutputCard({ show, performance, safety, onPatch }: OutputCardProps) {
  const [width, height] = performance.resolution;
  const adapting = safety.resolutionScale < 1;

  return (
    <Disclosure
      title="Output quality"
      summary={adapting ? `reduced to ${Math.round(safety.resolutionScale * 100)} %` : undefined}
    >
      <Slider
        label="Resolution budget"
        value={show.renderScale}
        min={0.25}
        max={2}
        step={0.05}
        format={(scale) => `${scale.toFixed(2)}× 1080p`}
        onInput={(renderScale) => onPatch({ renderScale })}
      />
      <Toggle
        label="Lower the resolution automatically when frames get slow"
        checked={show.adaptiveResolution}
        onChange={(adaptiveResolution) => onPatch({ adaptiveResolution })}
      />
      <div class="row">
        <Led on={safety.flashGuard > 0} label="flash guard" />
        <span class="hint row__end">
          {performance.fps.toFixed(0)} fps · {performance.frameMs.toFixed(1)} ms · {width}×{height}
        </span>
      </div>
    </Disclosure>
  );
}
