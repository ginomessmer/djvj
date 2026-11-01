/** Raw bytes, and when they arrived on the `performance.now()` clock (ms). */
export type MidiMessageHandler = (data: Uint8Array, timeStampMs: number) => void;

export interface MidiConnection {
  /** Names of the inputs currently connected. */
  readonly devices: string[];
  /** Called when a controller is plugged in or out. */
  onDevicesChange: (() => void) | null;
  close(): void;
}

export interface MidiInput {
  readonly supported: boolean;
  /**
   * Listens to every MIDI input, including ones plugged in later. The first call asks the user
   * for permission. Rejects with the browser's error (e.g. `NotAllowedError`) when denied.
   */
  open(onMessage: MidiMessageHandler): Promise<MidiConnection>;
}

/**
 * Web MIDI (Chrome, Edge, Firefox; not Safari). Read-only: djvj never sends anything to a
 * controller, so it cannot disturb rekordbox, which reads the same controller at the same time.
 */
export const webMidiInput: MidiInput = {
  get supported() {
    return typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;
  },

  async open(onMessage) {
    const access = await navigator.requestMIDIAccess({ sysex: false });
    const listener = (event: MIDIMessageEvent) => {
      if (event.data) onMessage(event.data, event.timeStamp || performance.now());
    };
    const attach = () => {
      for (const input of access.inputs.values()) input.onmidimessage = listener;
    };
    const connection: MidiConnection = {
      get devices() {
        return [...access.inputs.values()]
          .filter((input) => input.state === 'connected')
          .map((input) => input.name ?? 'MIDI input');
      },
      onDevicesChange: null,
      close: () => {
        access.onstatechange = null;
        for (const input of access.inputs.values()) input.onmidimessage = null;
      },
    };
    access.onstatechange = () => {
      attach();
      connection.onDevicesChange?.();
    };
    attach();
    return connection;
  },
};
