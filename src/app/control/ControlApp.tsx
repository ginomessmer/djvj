import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { shortcutPatch } from '@/domain/show/shortcuts';
import type { ShowPatch } from '@/domain/show/show-state';
import { MAX_TEXT_LENGTH, MAX_TEXTS } from '@/domain/show/texts';
import { readImageAsDataUrl } from '@/services/image-file';
import { imageStorage } from '@/services/image-storage';
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
  const showRef = useRef(snapshot?.show);
  showRef.current = snapshot?.show;
  // Thumbnails come straight from storage (same origin as the output); read once per image.
  const imageKey = snapshot?.images.join(',') ?? '';
  const thumbnails = useMemo(
    () =>
      Object.fromEntries(
        imageKey
          .split(',')
          .filter(Boolean)
          .map((id) => [id, imageStorage.load(id)]),
      ),
    [imageKey],
  );
  const onPatch = useCallback((patch: ShowPatch) => send({ type: 'patch', patch }), [send]);

  const actions = useMemo<ControlActions>(
    () => ({
      onPatch,
      onRefreshDevices: () => send({ type: 'refresh-devices' }),
      onTap: () => send({ type: 'tap' }),
      onClearTap: () => send({ type: 'clear-tap' }),
      onAddImage: (file) => {
        readImageAsDataUrl(file)
          .then((dataUrl) => {
            const texts = showRef.current?.texts ?? [];
            if (texts.length >= MAX_TEXTS) return;
            const id = crypto.randomUUID().slice(0, 18);
            const label = file.name.replace(/\.[a-z0-9]+$/i, '').slice(0, MAX_TEXT_LENGTH);
            // The image first: the entry that refers to it arrives after it, in order.
            send({ type: 'set-image', id, dataUrl });
            onPatch({ texts: [...texts, { text: label || 'image', cue: 'drop', imageId: id }] });
          })
          .catch((error: unknown) => console.warn('[djvj] could not read the image', error));
      },
      onShowText: (index) => send({ type: 'show-text', index }),
    }),
    [onPatch, send],
  );

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
      thumbnails={thumbnails}
      {...actions}
    />
  );
}
