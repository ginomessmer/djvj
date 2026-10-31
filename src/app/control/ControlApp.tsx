import { useCallback, useEffect, useRef } from 'preact/hooks';
import { shortcutPatch } from '@/domain/show/shortcuts';
import type { ShowPatch } from '@/domain/show/show-state';
import { onPlainKey } from '@/services/keyboard';
import { ControlPanel } from '@/ui/control/ControlPanel';
import { useRemote } from './use-remote';

export function ControlApp() {
  const { snapshot, connected, send } = useRemote();
  const onPatch = useCallback((patch: ShowPatch) => send({ type: 'patch', patch }), [send]);

  const showRef = useRef(snapshot?.show);
  showRef.current = snapshot?.show;
  useEffect(
    () =>
      onPlainKey((key) => {
        const show = showRef.current;
        const patch = show && shortcutPatch(key, show);
        if (patch) onPatch(patch);
      }),
    [onPatch],
  );

  return (
    <ControlPanel
      snapshot={snapshot}
      connected={connected}
      onPatch={onPatch}
      onRefreshDevices={() => send({ type: 'refresh-devices' })}
    />
  );
}
