import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import {
  CHANNEL_NAME,
  type ControlMessage,
  type OutputMessage,
  type ShowSnapshot,
} from '@/domain/remote/protocol';
import { createMessageBus, type MessageBus } from '@/services/message-bus';

const CONNECTION_TIMEOUT_MS = 2500;
const WATCHDOG_INTERVAL_MS = 1000;

/** Talks to the output window: latest snapshot, whether it is alive, and a way to send messages. */
export function useRemote() {
  const [snapshot, setSnapshot] = useState<ShowSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const busRef = useRef<MessageBus<ControlMessage, OutputMessage> | null>(null);

  useEffect(() => {
    const bus = createMessageBus<ControlMessage, OutputMessage>(CHANNEL_NAME);
    busRef.current = bus;
    let lastSeenMs = Number.NEGATIVE_INFINITY;

    const stopListening = bus.subscribe((message) => {
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
    }, WATCHDOG_INTERVAL_MS);
    bus.send({ type: 'hello' });

    return () => {
      clearInterval(watchdog);
      stopListening();
      bus.close();
    };
  }, []);

  const send = useCallback((message: ControlMessage) => busRef.current?.send(message), []);
  return { snapshot, connected, send };
}
