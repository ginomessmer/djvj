import type { PreviewFrame } from '@/domain/remote/preview';
import type { ShowSnapshot } from '@/domain/remote/protocol';
import type { ShowPatch } from '@/domain/show/show-state';
import type { Preferences } from '@/domain/ui/preferences';
import { AppearanceDialog } from './AppearanceDialog';
import { AudioInputPanel } from './AudioInputPanel';
import { CameraPanel } from './CameraPanel';
import { OutputPanel } from './OutputPanel';
import { OverlayPanel } from './OverlayPanel';
import { PreviewPanel } from './PreviewPanel';
import { RhythmPanel } from './RhythmPanel';
import { ScenesPanel } from './ScenesPanel';
import { ShortcutsDialog } from './ShortcutsDialog';
import { SignalPanel } from './SignalPanel';
import { StatusBar } from './StatusBar';
import { TopBar } from './TopBar';
import { useHint } from './use-hint';
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
 * A desktop-app window: toolbar on top, status bar below, and between them three docks that share
 * hairline dividers and scroll on their own (the window itself never does on a laptop):
 * rhythm and signal | monitor, scenes and palette | inspector with the set-once settings.
 * A tablet gets two columns, a phone one column that scrolls.
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
  const { root, hint } = useHint();
  const audioIdle =
    snapshot && connected && snapshot.audio.status !== 'running' && !snapshot.show.demo;

  return (
    <div class="app" ref={root}>
      <TopBar
        connected={connected}
        snapshot={snapshot}
        onPatch={onPatch}
        onOpenOutput={onOpenOutput}
        onOpenAppearance={() => onDialog('appearance')}
        onOpenShortcuts={() => onDialog('shortcuts')}
      />

      {snapshot && !connected && (
        <p class="banner banner--warn" role="alert">
          The output window closed.
          <button type="button" onClick={onOpenOutput}>
            Open it again
          </button>
        </p>
      )}
      {audioIdle && (
        <p class="banner" role="status">
          Audio is not running. Click once inside the output window to allow audio input, or use the
          demo signal.
          <button type="button" onClick={() => onPatch({ demo: true })}>
            Use demo signal
          </button>
        </p>
      )}

      <main class="workspace">
        {!snapshot && <Welcome blocked={launchBlocked} onOpenOutput={onOpenOutput} />}

        {snapshot && (
          <>
            <div class="dock dock--center">
              <PreviewPanel
                snapshot={snapshot}
                connected={connected}
                subscribeFrames={subscribeFrames}
                onPatch={onPatch}
              />
              <ScenesPanel
                show={snapshot.show}
                shownSceneId={snapshot.shownSceneId}
                cameraReady={snapshot.camera.ready}
                onPatch={onPatch}
              />
            </div>
            <div class="dock dock--left">
              <RhythmPanel
                rhythm={snapshot.rhythm}
                show={snapshot.show}
                onPatch={onPatch}
                onTap={actions.onTap}
                onClearTap={actions.onClearTap}
              />
              <SignalPanel signal={snapshot.signal} />
            </div>
            <div class="dock dock--right">
              <AudioInputPanel
                audio={snapshot.audio}
                show={snapshot.show}
                onPatch={onPatch}
                onRefreshDevices={actions.onRefreshDevices}
              />
              <CameraPanel
                camera={snapshot.camera}
                show={snapshot.show}
                onPatch={onPatch}
                onRefreshDevices={actions.onRefreshDevices}
              />
              <OutputPanel
                show={snapshot.show}
                performance={snapshot.performance}
                safety={snapshot.safety}
                onPatch={onPatch}
              />
              <OverlayPanel
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

      <StatusBar connected={connected} snapshot={snapshot} hint={hint} />

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
