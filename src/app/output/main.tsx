import { render } from 'preact';
import { CHANNEL_NAME, type ControlMessage, type OutputMessage } from '@/domain/remote/protocol';
import { Director } from '@/domain/show/director';
import { AudioPipeline } from '@/features/audio/audio-pipeline';
import { OutputRuntime } from '@/features/output/output-runtime';
import { linkOutputToBus } from '@/features/remote/output-link';
import { createShowStore } from '@/features/show/show-store';
import { AudioInput } from '@/services/audio-input';
import { logoStorage } from '@/services/logo-storage';
import { createMessageBus } from '@/services/message-bus';
import { StartOverlay } from '@/ui/output/StartOverlay';
import { Stage } from '@/vfx/stage';
import '@/ui/styles/base.css';
import '@/ui/styles/output.css';
import { requireElement } from '../dom';
import { OutputApp } from './OutputApp';

/** Composition root of the output window: builds the objects and wires them together. */
function main(): void {
  const root = requireElement('root');
  try {
    const store = createShowStore();
    const stage = new Stage(requireElement('stage'));
    const audio = new AudioPipeline(new AudioInput(), store.getState().silenceDb);
    const director = new Director(store.getState().sceneId);
    const runtime = new OutputRuntime({ stage, store, audio, director, logoStorage });

    linkOutputToBus(runtime, store, createMessageBus<OutputMessage, ControlMessage>(CHANNEL_NAME));
    runtime.start();
    if (import.meta.env.DEV) {
      Object.assign(window, {
        __djvj: { snapshot: () => runtime.getSnapshot(), inspect: () => runtime.inspect() },
      });
    }
    render(<OutputApp runtime={runtime} store={store} />, root);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    render(<StartOverlay message={`⚠ ${reason}`} />, root);
  }
}

main();
