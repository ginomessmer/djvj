import type { ShowSnapshot } from '@/domain/remote/protocol';
import { findPalette } from '@/domain/show/palettes';
import { SCENES } from '@/domain/show/scenes';
import { Led } from '../components/Led';

interface StatusBarProps {
  connected: boolean;
  snapshot: ShowSnapshot | null;
  /** What the control under the pointer (or with focus) does. */
  hint: string | null;
}

function audioText({ audio, show }: ShowSnapshot): string {
  if (show.demo) return 'Demo signal';
  if (audio.status === 'running') return 'Listening';
  if (audio.status === 'error') return 'Audio error';
  return 'Audio not started';
}

/** The window's footer, like the one in any desktop app: the facts that are never in the way. */
export function StatusBar({ connected, snapshot, hint }: StatusBarProps) {
  if (!snapshot) {
    return (
      <footer class="statusbar">
        <span>Waiting for the output window</span>
      </footer>
    );
  }
  const { show, performance, shownSceneId, signal } = snapshot;
  const scene = SCENES.find((info) => info.id === shownSceneId);
  const [width, height] = performance.resolution;

  return (
    <footer class="statusbar">
      <Led on={connected} label={connected ? 'Output connected' : 'Output closed'} />
      <span>{audioText(snapshot)}</span>
      <span class="statusbar__num">{signal.loudnessDb.toFixed(0)} dBFS</span>
      <span
        class={hint ? 'statusbar__hint statusbar__hint--on' : 'statusbar__hint'}
        aria-hidden="true"
      >
        {hint ?? 'Hover a control to see what it does'}
      </span>
      <span>
        {scene?.name ?? shownSceneId} · {show.auto ? 'auto' : 'locked'}
      </span>
      <span>{findPalette(show.paletteId).name}</span>
      <span class="statusbar__num">
        {performance.fps.toFixed(0)} fps · {width}×{height}
      </span>
    </footer>
  );
}
