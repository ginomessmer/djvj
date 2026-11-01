import { useEffect, useState } from 'preact/hooks';
import type { ShowSnapshot } from '@/domain/remote/protocol';
import type { OutputRuntime } from '@/features/output/output-runtime';

const CURSOR_HIDE_DELAY_MS = 2000;

/** Re-renders with every snapshot the runtime publishes. */
export function useSnapshot(runtime: OutputRuntime): ShowSnapshot {
  const [snapshot, setSnapshot] = useState(() => runtime.getSnapshot());
  useEffect(() => runtime.subscribe(setSnapshot), [runtime]);
  return snapshot;
}

/** Hides the mouse cursor while it is not moving: the output is shown on a big screen. */
export function useIdleCursor(): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onMove = () => {
      document.body.classList.remove('idle');
      clearTimeout(timer);
      timer = setTimeout(() => document.body.classList.add('idle'), CURSOR_HIDE_DELAY_MS);
    };
    onMove();
    window.addEventListener('mousemove', onMove);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousemove', onMove);
    };
  }, []);
}
