export interface MessageBus<Outgoing, Incoming> {
  send(message: Outgoing): void;
  /** @returns a function that stops listening */
  subscribe(handler: (message: Incoming) => void): () => void;
  close(): void;
}

/**
 * Typed wrapper around a `BroadcastChannel`: same-origin windows talk to each other without a
 * server. A channel never delivers a window's own messages back to it.
 */
export function createMessageBus<Outgoing, Incoming>(
  channelName: string,
): MessageBus<Outgoing, Incoming> {
  const channel = new BroadcastChannel(channelName);
  return {
    send: (message) => channel.postMessage(message),
    subscribe: (handler) => {
      const listener = (event: MessageEvent<Incoming>) => handler(event.data);
      channel.addEventListener('message', listener);
      return () => channel.removeEventListener('message', listener);
    },
    close: () => channel.close(),
  };
}
