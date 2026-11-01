import { useEffect, useRef } from 'preact/hooks';
import type { PreviewFrame } from '@/domain/remote/preview';
import type { ShowSnapshot } from '@/domain/remote/protocol';
import { findPalette } from '@/domain/show/palettes';
import { SCENES } from '@/domain/show/scenes';
import type { ShowPatch } from '@/domain/show/show-state';
import { Card } from '../components/Card';
import { Slider } from '../components/Slider';

interface PreviewCardProps {
  snapshot: ShowSnapshot;
  connected: boolean;
  subscribeFrames: (listener: (frame: PreviewFrame) => void) => () => void;
  onPatch: (patch: ShowPatch) => void;
}

/** Paints preview frames straight onto a canvas: they come ~10 times a second. */
function useFrames(
  subscribe: PreviewCardProps['subscribeFrames'],
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

export function PreviewCard({ snapshot, connected, subscribeFrames, onPatch }: PreviewCardProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useFrames(subscribeFrames, canvas);

  const { show, performance, shownSceneId } = snapshot;
  const scene = SCENES.find((info) => info.id === shownSceneId);
  const [width, height] = performance.resolution;

  return (
    <Card title="Preview" class="card--preview">
      <div class={connected ? 'preview' : 'preview preview--offline'}>
        <canvas
          ref={canvas}
          class="preview__canvas"
          width="256"
          height="144"
          role="img"
          aria-label="Live copy of the output screen"
        />
        {!connected && <span class="preview__note">Output window closed</span>}
        {show.blackout && connected && <span class="preview__note">Blackout</span>}
      </div>
      <p class="caption">
        <strong>{scene?.name ?? shownSceneId}</strong>
        <span>{show.auto ? 'auto' : 'locked'}</span>
        <span>{findPalette(show.paletteId).name}</span>
        <span class="caption__end">
          {performance.fps.toFixed(0)} fps · {width}×{height}
        </span>
      </p>
      <Slider
        label="Brightness"
        value={show.intensity}
        min={0}
        max={1}
        step={0.01}
        format={(value) => `${Math.round(value * 100)} %`}
        onInput={(intensity) => onPatch({ intensity })}
      />
    </Card>
  );
}
