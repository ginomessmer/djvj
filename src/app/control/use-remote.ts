import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { PreviewFrame } from '@/domain/remote/preview';
import {
  CHANNEL_NAME,
  type ControlMessage,
  type OutputMessage,
  type ShowSnapshot,
} from '@/domain/remote/protocol';
import { createMessageBus, type MessageBus } from '@/services/message-bus';

const CONNECTION_TIMEOUT_MS = 2500;
const WATCHDOG_INTERVAL_MS = 1000;

type FrameListener = (frame: PreviewFrame) => void;

/**
 * Talks to the output window: latest snapshot, whether it is alive, a way to send messages and
 * the live preview frames. Frames bypass React state: they arrive ~10 times a second and go
 * straight to a canvas.
 */
export function useRemote() {
  const [snapshot, setSnapshot] = useState<ShowSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const busRef = useRef<MessageBus<ControlMessage, OutputMessage> | null>(null);
  const frameListeners = useRef(new Set<FrameListener>());

  useEffect(() => {
    const bus = createMessageBus<ControlMessage, OutputMessage>(CHANNEL_NAME);
    busRef.current = bus;
    let lastSeenMs = Number.NEGATIVE_INFINITY;

    const stopListening = bus.subscribe((message) => {
      if (message.type === 'frame') {
        for (const listener of frameListeners.current) listener(message.frame);
        return;
      }
      if (message.type !== 'snapshot') return;
      lastSeenMs = performance.now();
      setSnapshot(message.snapshot);
      setConnected(true);
    });
    // The output may open later or be reloaded: keep asking until it answers.
    const watchdog = setInterval(() => {
      const alive = performance.now() - lastSeenMs < CONNECTION_TIMEOUT_MS;
      setConnected(alive);
      if (!alive) bus.send({ type: 'hello' });
      // Only ask for frames while somebody can see them: a hidden tab should not cost the output.
      else if (document.visibilityState === 'visible') bus.send({ type: 'watch-preview' });
    }, WATCHDOG_INTERVAL_MS);
    bus.send({ type: 'hello' });

    return () => {
      clearInterval(watchdog);
      stopListening();
      bus.close();
    };
  }, []);

  const send = useCallback((message: ControlMessage) => busRef.current?.send(message), []);
  const subscribeFrames = useCallback((listener: FrameListener) => {
    frameListeners.current.add(listener);
    return () => {
      frameListeners.current.delete(listener);
    };
  }, []);
  return { snapshot, connected, send, subscribeFrames };
}
