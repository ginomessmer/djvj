/**
 * Messages between the two windows. The output window owns all state and rendering and keeps
 * working with no control window at all; the control window only sends commands and shows state.
 */

export const CHANNEL_NAME = 'djvj';

export interface DeviceInfo {
  id: string;
  label: string;
}

export interface NamedItem {
  id: string;
  name: string;
}

export type AudioStatus = 'idle' | 'running' | 'error';

export interface OutputState {
  audio: AudioStatus;
  error: string | null;
  devices: DeviceInfo[];
  deviceId: string;

  scenes: NamedItem[];
  sceneId: string;
  /** What is actually on screen right now (differs while idle / panic / fading). */
  shownSceneId: string;
  palettes: NamedItem[];
  paletteId: string;

  auto: boolean;
  demo: boolean;
  blackout: boolean;
  panic: boolean;
  intensity: number;
  renderScale: number;
  silenceDb: number;

  signal: boolean;
  bands: number[];
  energy: number;
  kick: number;
  loudnessDb: number;

  fps: number;
  frameMs: number;
  resolution: [number, number];
}

export type Command =
  | { type: 'request-state' }
  | { type: 'select-scene'; id: string }
  | { type: 'next-scene' }
  | { type: 'set-auto'; on: boolean }
  | { type: 'set-palette'; id: string }
  | { type: 'next-palette' }
  | { type: 'set-intensity'; value: number }
  | { type: 'set-render-scale'; value: number }
  | { type: 'set-silence-db'; value: number }
  | { type: 'set-demo'; on: boolean }
  | { type: 'blackout'; on?: boolean }
  | { type: 'panic'; on?: boolean }
  | { type: 'set-device'; id: string }
  | { type: 'refresh-devices' };

export type Message = { kind: 'command'; command: Command } | { kind: 'state'; state: OutputState };

export interface Bus {
  post(message: Message): void;
  onMessage(handler: (message: Message) => void): void;
  close(): void;
}

export function openBus(): Bus {
  const channel = new BroadcastChannel(CHANNEL_NAME);
  return {
    post: (message) => channel.postMessage(message),
    onMessage: (handler) => {
      channel.onmessage = (e: MessageEvent<Message>) => handler(e.data);
    },
    close: () => channel.close(),
  };
}
