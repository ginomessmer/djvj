import { render } from 'preact';
import { CHANNEL_NAME, type ControlMessage, type OutputMessage } from '@/domain/remote/protocol';
import { Director } from '@/domain/show/director';
import { AudioPipeline } from '@/features/audio/audio-pipeline';
import { CameraPipeline } from '@/features/camera/camera-pipeline';
import { OutputRuntime } from '@/features/output/output-runtime';
import { linkOutputToBus } from '@/features/remote/output-link';
import { createShowStore } from '@/features/show/show-store';
import { AudioInput } from '@/services/audio-input';
import { CameraInput } from '@/services/camera-input';
import { forgetLegacyLogo, imageStorage } from '@/services/image-storage';
import { createMessageBus } from '@/services/message-bus';
import { StartOverlay } from '@/ui/output/StartOverlay';
import { Stage } from '@/vfx/stage';
import '@/ui/styles/themes.css';
import '@/ui/styles/base.css';
import '@/ui/styles/output.css';
import { requireElement } from '../dom';
import { OutputApp } from './OutputApp';

/** Composition root of the output window: builds the objects and wires them together. */
function main(): void {
  document.title = 'djvj output';
  const root = requireElement('root');
  try {
    const store = createShowStore();
    const stage = new Stage(requireElement('stage'));
    const audio = new AudioPipeline(new AudioInput(), store.getState().silenceDb);
    const camera = new CameraPipeline(new CameraInput());
    const director = new Director(store.getState().sceneId);
    forgetLegacyLogo();
    const runtime = new OutputRuntime({ stage, store, audio, camera, director, imageStorage });

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
