import { useCallback, useEffect, useMemo, useRef } from 'preact/hooks';
import { shortcutPatch } from '@/domain/show/shortcuts';
import type { ShowPatch } from '@/domain/show/show-state';
import { readImageAsDataUrl } from '@/services/image-file';
import { onPlainKey } from '@/services/keyboard';
import { type ControlActions, ControlPanel } from '@/ui/control/ControlPanel';
import { useRemote } from './use-remote';

export function ControlApp() {
  const { snapshot, connected, send } = useRemote();
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
      onMidiLearn: (action) => send({ type: 'midi-learn', action }),
    }),
    [onPatch, send],
  );

  const showRef = useRef(snapshot?.show);
  showRef.current = snapshot?.show;
  useEffect(
    () =>
      onPlainKey((key) => {
        if (key === 't') return actions.onTap();
        const show = showRef.current;
        const patch = show && shortcutPatch(key, show);
        if (patch) onPatch(patch);
      }),
    [actions, onPatch],
  );

  return <ControlPanel snapshot={snapshot} connected={connected} {...actions} />;
}
