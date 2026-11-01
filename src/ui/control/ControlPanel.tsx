import type { ShowSnapshot } from '@/domain/remote/protocol';
import type { ShowPatch } from '@/domain/show/show-state';
import { AudioInputCard } from './AudioInputCard';
import { OutputCard } from './OutputCard';
import { OverlayCard } from './OverlayCard';
import { RhythmCard } from './RhythmCard';
import { SceneCard } from './SceneCard';
import { SignalCard } from './SignalCard';

export interface ControlActions {
  onPatch: (patch: ShowPatch) => void;
  onRefreshDevices: () => void;
  onTap: () => void;
  onClearTap: () => void;
  onLogoFile: (file: File) => void;
  onRemoveLogo: () => void;
}

interface ControlPanelProps extends ControlActions {
  /** Null until the output window answered. */
  snapshot: ShowSnapshot | null;
  connected: boolean;
}

export function ControlPanel({ snapshot, connected, ...actions }: ControlPanelProps) {
  const { onPatch } = actions;
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
            onRefreshDevices={actions.onRefreshDevices}
          />
          <SignalCard signal={snapshot.signal} />
          <RhythmCard
            rhythm={snapshot.rhythm}
            show={snapshot.show}
            onPatch={onPatch}
            onTap={actions.onTap}
            onClearTap={actions.onClearTap}
          />
          <SceneCard show={snapshot.show} shownSceneId={snapshot.shownSceneId} onPatch={onPatch} />
          <OverlayCard
            show={snapshot.show}
            overlay={snapshot.overlay}
            onPatch={onPatch}
            onLogoFile={actions.onLogoFile}
            onRemoveLogo={actions.onRemoveLogo}
          />
          <OutputCard
            show={snapshot.show}
            performance={snapshot.performance}
            safety={snapshot.safety}
            onPatch={onPatch}
          />
        </>
      )}

      <footer class="muted">
        Keys here and in the output window: <kbd>A</kbd> auto · <kbd>N</kbd> next · <kbd>C</kbd>{' '}
        palette · <kbd>T</kbd> tap tempo · <kbd>B</kbd> blackout · <kbd>P</kbd> panic · <kbd>M</kbd>{' '}
        demo. <kbd>F</kbd> (fullscreen) only works in the output window.
      </footer>
    </main>
  );
}
