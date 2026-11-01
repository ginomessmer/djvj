/** A MIDI control: a key/pad/button (note) or a knob/fader/button (control change). */
export interface MidiControl {
  kind: 'note' | 'cc';
  /** 0..15 (shown as 1..16). */
  channel: number;
  /** Note or controller number, 0..127. */
  number: number;
}

/** A message from a control: velocity for notes (0 = released), position for CCs. 0..127. */
export interface MidiEvent extends MidiControl {
  value: number;
}

const NOTE_OFF = 0x80;
const NOTE_ON = 0x90;
const CONTROL_CHANGE = 0xb0;

/**
 * Reads the messages controls send: note on/off and control change. Everything else (clock,
 * SysEx, pitch bend, aftertouch) is `null`.
 */
export function parseMidi(data: ArrayLike<number>): MidiEvent | null {
  if (data.length < 3) return null;
  const type = data[0] & 0xf0;
  const channel = data[0] & 0x0f;
  const number = data[1] & 0x7f;
  const value = data[2] & 0x7f;
  switch (type) {
    case NOTE_ON:
      return { kind: 'note', channel, number, value };
    case NOTE_OFF:
      return { kind: 'note', channel, number, value: 0 };
    case CONTROL_CHANGE:
      return { kind: 'cc', channel, number, value };
    default:
      return null;
  }
}

export function sameControl(a: MidiControl, b: MidiControl): boolean {
  return a.kind === b.kind && a.channel === b.channel && a.number === b.number;
}

export function describeControl({ kind, channel, number }: MidiControl): string {
  return `${kind === 'note' ? 'Note' : 'CC'} ${number} · ch ${channel + 1}`;
}

export function describeEvent(event: MidiEvent): string {
  return `${describeControl(event)} = ${event.value}`;
}
