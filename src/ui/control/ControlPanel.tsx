import type { ShowSnapshot } from '@/domain/remote/protocol';
import type { ShowPatch } from '@/domain/show/show-state';
import { AudioInputCard } from './AudioInputCard';
import { OutputCard } from './OutputCard';
import { RhythmCard } from './RhythmCard';
import { SceneCard } from './SceneCard';
import { SignalCard } from './SignalCard';

interface ControlPanelProps {
  /** Null until the output window answered. */
  snapshot: ShowSnapshot | null;
  connected: boolean;
  onPatch: (patch: ShowPatch) => void;
  onRefreshDevices: () => void;
}

export function ControlPanel({
  snapshot,
  connected,
  onPatch,
  onRefreshDevices,
}: ControlPanelProps) {
  return (
    <main class="control">
      <header class="control__header">
        <h1>
          djvj <small>control</small>
        </h1>
        <span class={connected ? 'pill pill--ok' : 'pill pill--warn'}>
          {connected ? 'output connected' : 'waiting for output window…'}
        </span>
      </header>

      {snapshot && (
        <>
          <AudioInputCard
            audio={snapshot.audio}
            show={snapshot.show}
            onPatch={onPatch}
            onRefreshDevices={onRefreshDevices}
          />
          <SignalCard signal={snapshot.signal} />
          <RhythmCard rhythm={snapshot.rhythm} show={snapshot.show} onPatch={onPatch} />
          <SceneCard show={snapshot.show} shownSceneId={snapshot.shownSceneId} onPatch={onPatch} />
          <OutputCard show={snapshot.show} performance={snapshot.performance} onPatch={onPatch} />
        </>
      )}

      <footer class="muted">
        Keys here and in the output window: <kbd>A</kbd> auto · <kbd>N</kbd> next · <kbd>C</kbd>{' '}
        palette · <kbd>B</kbd> blackout · <kbd>P</kbd> panic · <kbd>M</kbd> demo. <kbd>F</kbd>{' '}
        (fullscreen) only works in the output window.
      </footer>
    </main>
  );
}
