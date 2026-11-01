import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { shortcutPatch } from '@/domain/show/shortcuts';
import type { ShowPatch } from '@/domain/show/show-state';
import { readImageAsDataUrl } from '@/services/image-file';
import { onPlainKey } from '@/services/keyboard';
import { type ControlActions, ControlPanel, type DialogName } from '@/ui/control/ControlPanel';
import { useOutputLauncher } from './use-output-launcher';
import { usePreferences } from './use-preferences';
import { useRemote } from './use-remote';

export function ControlApp() {
  const { snapshot, connected, send, subscribeFrames } = useRemote();
  const { open: openOutput, blocked } = useOutputLauncher(connected);
  const { preferences, update, reset } = usePreferences();
  const [dialog, setDialog] = useState<DialogName | null>(null);
  const onPatch = useCallback((patch: ShowPatch) => send({ type: 'patch', patch }), [send]);

  const actions = useMemo<ControlActions>(
    () => ({
      onPatch,
      onRefreshDevices: () => send({ type: 'refresh-devices' }),
      onTap: () => send({ type: 'tap' }),
      onClearTap: () => send({ type: 'clear-tap' }),
      onLogoFile: (file) => {
        readImageAsDataUrl(file)
          .then((dataUrl) => send({ type: 'set-logo', dataUrl }))
          .catch((error: unknown) => console.warn('[djvj] could not read the logo', error));
      },
      onRemoveLogo: () => send({ type: 'set-logo', dataUrl: '' }),
    }),
    [onPatch, send],
  );

  const showRef = useRef(snapshot?.show);
  showRef.current = snapshot?.show;
  const dialogRef = useRef(dialog);
  dialogRef.current = dialog;
  useEffect(
    () =>
      onPlainKey((key) => {
        if (key === '?') return setDialog((open) => (open === 'shortcuts' ? null : 'shortcuts'));
        // With a dialog open the keys belong to it (a colour picker, a radio group).
        if (dialogRef.current) return;
        if (key === 'o') return openOutput();
        if (key === 't') return actions.onTap();
        const show = showRef.current;
        const patch = show && shortcutPatch(key, show);
        if (patch) onPatch(patch);
      }),
    [actions, onPatch, openOutput],
  );

  return (
    <ControlPanel
      snapshot={snapshot}
      connected={connected}
      launchBlocked={blocked}
      onOpenOutput={openOutput}
      subscribeFrames={subscribeFrames}
      preferences={preferences}
      onPreferences={update}
      onResetPreferences={reset}
      dialog={dialog}
      onDialog={setDialog}
      {...actions}
    />
  );
}
