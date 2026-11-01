import type { MidiAction } from './midi-mapping';

/** off = not enabled, pending = waiting for the browser's permission. */
export type MidiStatus = 'off' | 'pending' | 'on' | 'denied' | 'unsupported' | 'error';

export interface MidiState {
  status: MidiStatus;
  /** Names of the connected MIDI inputs. */
  devices: string[];
  /** The action waiting for a control to be moved, or null. */
  learning: MidiAction | null;
  /** The last message received, readable, for checking a controller: "CC 19 · ch 1 = 64". */
  lastEvent: string | null;
}
