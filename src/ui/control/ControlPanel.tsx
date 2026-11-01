import type { PreviewFrame } from '@/domain/remote/preview';
import type { ShowSnapshot } from '@/domain/remote/protocol';
import type { ShowPatch } from '@/domain/show/show-state';
import type { Preferences } from '@/domain/ui/preferences';
import { AppearanceDialog } from './AppearanceDialog';
import { AudioInputCard } from './AudioInputCard';
import { OutputCard } from './OutputCard';
import { OverlayCard } from './OverlayCard';
import { PreviewCard } from './PreviewCard';
import { RhythmCard } from './RhythmCard';
import { ScenesCard } from './ScenesCard';
import { ShortcutsDialog } from './ShortcutsDialog';
import { SignalCard } from './SignalCard';
import { TopBar } from './TopBar';
import { Welcome } from './Welcome';

export interface ControlActions {
  onPatch: (patch: ShowPatch) => void;
  onRefreshDevices: () => void;
  onTap: () => void;
  onClearTap: () => void;
  onLogoFile: (file: File) => void;
  onRemoveLogo: () => void;
}

export type DialogName = 'appearance' | 'shortcuts';

interface ControlPanelProps extends ControlActions {
  /** Null until the output window answered. */
  snapshot: ShowSnapshot | null;
  connected: boolean;
  /** The browser refused to open the output window by itself. */
  launchBlocked: boolean;
  onOpenOutput: () => void;
  subscribeFrames: (listener: (frame: PreviewFrame) => void) => () => void;
  preferences: Preferences;
  onPreferences: (patch: Partial<Preferences>) => void;
  onResetPreferences: () => void;
  dialog: DialogName | null;
  onDialog: (dialog: DialogName | null) => void;
}

/**
 * Laptop first: three columns (preview and signal | scenes and palette | rhythm and setup).
 * A tablet gets two columns, a phone one. Set-once settings sit in collapsed cards at the end.
 */
export function ControlPanel({
  snapshot,
  connected,
  launchBlocked,
  onOpenOutput,
  subscribeFrames,
  preferences,
  onPreferences,
  onResetPreferences,
  dialog,
  onDialog,
  ...actions
}: ControlPanelProps) {
  const { onPatch } = actions;
  const audioIdle =
    snapshot && connected && snapshot.audio.status !== 'running' && !snapshot.show.demo;

  return (
    <div class="app">
      <TopBar
        connected={connected}
        snapshot={snapshot}
        onPatch={onPatch}
        onOpenOutput={onOpenOutput}
        onOpenAppearance={() => onDialog('appearance')}
        onOpenShortcuts={() => onDialog('shortcuts')}
      />

      <main class="workspace">
        {!snapshot && <Welcome blocked={launchBlocked} onOpenOutput={onOpenOutput} />}

        {snapshot && (
          <>
            {!connected && (
              <p class="notice notice--warn notice--wide" role="alert">
                The output window closed.{' '}
                <button type="button" onClick={onOpenOutput}>
                  Open it again
                </button>
              </p>
            )}
            {audioIdle && (
              <p class="notice notice--wide" role="status">
                Audio is not running. Click once inside the output window to allow audio input, or
                use the demo signal.{' '}
                <button type="button" onClick={() => onPatch({ demo: true })}>
                  Use demo signal
                </button>
              </p>
            )}

            <div class="area area--preview">
              <PreviewCard
                snapshot={snapshot}
                connected={connected}
                subscribeFrames={subscribeFrames}
                onPatch={onPatch}
              />
              <SignalCard signal={snapshot.signal} />
            </div>
            <div class="area area--scenes">
              <ScenesCard
                show={snapshot.show}
                shownSceneId={snapshot.shownSceneId}
                onPatch={onPatch}
              />
            </div>
            <div class="area area--setup">
              <RhythmCard
                rhythm={snapshot.rhythm}
                show={snapshot.show}
                onPatch={onPatch}
                onTap={actions.onTap}
                onClearTap={actions.onClearTap}
              />
              <AudioInputCard
                audio={snapshot.audio}
                show={snapshot.show}
                onPatch={onPatch}
                onRefreshDevices={actions.onRefreshDevices}
              />
              <OutputCard
                show={snapshot.show}
                performance={snapshot.performance}
                safety={snapshot.safety}
                onPatch={onPatch}
              />
              <OverlayCard
                show={snapshot.show}
                overlay={snapshot.overlay}
                onPatch={onPatch}
                onLogoFile={actions.onLogoFile}
                onRemoveLogo={actions.onRemoveLogo}
              />
            </div>
          </>
        )}
      </main>

      <AppearanceDialog
        open={dialog === 'appearance'}
        preferences={preferences}
        onChange={onPreferences}
        onReset={onResetPreferences}
        onClose={() => onDialog(null)}
      />
      <ShortcutsDialog open={dialog === 'shortcuts'} onClose={() => onDialog(null)} />
    </div>
  );
}
