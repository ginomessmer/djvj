import type { ControlMessage, OutputMessage } from '@/domain/remote/protocol';
import type { MessageBus } from '@/services/message-bus';
import type { OutputRuntime } from '../output/output-runtime';
import type { ShowStoreApi } from '../show/show-store';

/**
 * Connects the output window to the control window: snapshots go out, control messages come in.
 * @returns a function that disconnects
 */
export function linkOutputToBus(
  runtime: OutputRuntime,
  store: ShowStoreApi,
  bus: MessageBus<OutputMessage, ControlMessage>,
): () => void {
  const sendSnapshot = () => bus.send({ type: 'snapshot', snapshot: runtime.getSnapshot() });

  const stopSnapshots = runtime.subscribe((snapshot) => bus.send({ type: 'snapshot', snapshot }));
  const stopMessages = bus.subscribe((message) => {
    switch (message.type) {
      case 'hello':
        sendSnapshot();
        break;
      case 'patch':
        store.getState().apply(message.patch);
        break;
      case 'refresh-devices':
        void runtime.refreshDevices();
        break;
      case 'tap':
        runtime.tap();
        break;
      case 'clear-tap':
        runtime.clearTap();
        break;
      case 'set-logo':
        if (typeof message.dataUrl === 'string') runtime.setLogo(message.dataUrl);
        break;
    }
  });

  return () => {
    stopSnapshots();
    stopMessages();
  };
}
