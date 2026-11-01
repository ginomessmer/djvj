import { useEffect, useState } from 'preact/hooks';
import { shortcutPatch } from '@/domain/show/shortcuts';
import type { OutputRuntime } from '@/features/output/output-runtime';
import type { ShowStoreApi } from '@/features/show/show-store';
import { onPlainKey, toggleFullscreen } from '@/services/keyboard';
import { DebugHud } from '@/ui/output/DebugHud';
import { StartOverlay } from '@/ui/output/StartOverlay';
import { useIdleCursor, useSnapshot } from './hooks';

interface OutputAppProps {
  runtime: OutputRuntime;
  store: ShowStoreApi;
}

export function OutputApp({ runtime, store }: OutputAppProps) {
  const snapshot = useSnapshot(runtime);
  const [hudVisible, setHudVisible] = useState(false);
  useIdleCursor();

  useEffect(
    () =>
      onPlainKey((key) => {
        if (key === 'f') return toggleFullscreen();
        if (key === 'd') return setHudVisible((visible) => !visible);
        const patch = shortcutPatch(key, store.getState());
        if (patch) store.getState().apply(patch);
      }),
    [store],
  );

  const { audio, show } = snapshot;
  const needsAudio = audio.status !== 'running' && !show.demo;
  const message =
    audio.status === 'error' && audio.error ? `⚠ ${audio.error}` : 'Click to start audio input';

  return (
    <>
      {needsAudio && <StartOverlay message={message} onStart={() => void runtime.startAudio()} />}
      {hudVisible && <DebugHud snapshot={snapshot} />}
    </>
  );
}
