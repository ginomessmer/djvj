import { useEffect, useRef } from 'preact/hooks';
import type { PreviewFrame } from '@/domain/remote/preview';
import type { ShowSnapshot } from '@/domain/remote/protocol';
import { findPalette } from '@/domain/show/palettes';
import { SCENES } from '@/domain/show/scenes';
import type { ShowPatch } from '@/domain/show/show-state';
import { Panel } from '../components/Panel';
import { Slider } from '../components/Slider';

interface PreviewPanelProps {
  snapshot: ShowSnapshot;
  connected: boolean;
  subscribeFrames: (listener: (frame: PreviewFrame) => void) => () => void;
  onPatch: (patch: ShowPatch) => void;
}

/** Paints preview frames straight onto a canvas: they come ~10 times a second. */
function useFrames(
  subscribe: PreviewPanelProps['subscribeFrames'],
  canvas: { current: HTMLCanvasElement | null },
) {
  useEffect(
    () =>
      subscribe((frame) => {
        const element = canvas.current;
        const context = element?.getContext('2d');
        if (!element || !context) return;
        if (element.width !== frame.width || element.height !== frame.height) {
          element.width = frame.width;
          element.height = frame.height;
        }
        const pixels = new Uint8ClampedArray(frame.pixels);
        context.putImageData(new ImageData(pixels, frame.width, frame.height), 0, 0);
      }),
    [subscribe, canvas],
  );
}

export function PreviewPanel({ snapshot, connected, subscribeFrames, onPatch }: PreviewPanelProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useFrames(subscribeFrames, canvas);

  const { show, shownSceneId } = snapshot;
  const scene = SCENES.find((info) => info.id === shownSceneId);

  return (
    <Panel title="Monitor" class="panel--preview panel--flush">
      <div class={connected ? 'preview' : 'preview preview--offline'}>
        <canvas
          ref={canvas}
          class="preview__canvas"
          width="384"
          height="216"
          role="img"
          aria-label="Live copy of the output screen"
        />
        {!connected && <span class="preview__note">Output window closed</span>}
        {show.blackout && connected && <span class="preview__note">Blackout</span>}
        <span class="preview__osd" aria-hidden="true">
          {scene?.name ?? shownSceneId} · {findPalette(show.paletteId).name}
        </span>
      </div>
      <div class="panel__strip">
        <Slider
          label="Brightness"
          value={show.intensity}
          min={0}
          max={1}
          step={0.01}
          format={(value) => `${Math.round(value * 100)} %`}
          onInput={(intensity) => onPatch({ intensity })}
        />
      </div>
    </Panel>
  );
}
