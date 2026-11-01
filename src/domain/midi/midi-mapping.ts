import { z } from 'zod';
import type { ShowCommand } from '../show/shortcuts';
import type { ShowPatch } from '../show/show-state';
import { type MidiControl, type MidiEvent, sameControl } from './midi-message';

/** What a MIDI control can do. Triggers fire on a press; continuous ones follow a knob or fader. */
export const MIDI_ACTIONS = [
  'panic',
  'blackout',
  'tap',
  'clear-tap',
  'auto',
  'next-scene',
  'next-palette',
  'brightness',
] as const;
export type MidiAction = (typeof MIDI_ACTIONS)[number];

/** What an action does: a show command, a tap, or (continuous) a patch from the control's level. */
export type MidiEffect =
  | { type: 'command'; command: ShowCommand }
  | { type: 'tap' }
  | { type: 'clear-tap' }
  | { type: 'level'; patch: (level: number) => ShowPatch };

interface MidiActionInfo {
  label: string;
  effect: MidiEffect;
}

const command = (name: ShowCommand): MidiEffect => ({ type: 'command', command: name });

export const MIDI_ACTION_INFO: Record<MidiAction, MidiActionInfo> = {
  panic: { label: 'Panic', effect: command('panic') },
  blackout: { label: 'Blackout', effect: command('blackout') },
  tap: { label: 'Tap tempo', effect: { type: 'tap' } },
  'clear-tap': { label: 'Tempo back to auto', effect: { type: 'clear-tap' } },
  auto: { label: 'Auto on / off', effect: command('auto') },
  'next-scene': { label: 'Next scene', effect: command('next-scene') },
  'next-palette': { label: 'Next palette', effect: command('next-palette') },
  brightness: {
    label: 'Brightness (knob / fader)',
    effect: { type: 'level', patch: (level) => ({ intensity: level }) },
  },
};

/** Continuous actions follow a knob or fader; all others are triggers that fire on a press. */
export const isContinuous = (action: MidiAction): boolean =>
  MIDI_ACTION_INFO[action].effect.type === 'level';

const midiControlSchema = z.object({
  kind: z.enum(['note', 'cc']),
  channel: z.int().min(0).max(15),
  number: z.int().min(0).max(127),
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** Keeps only the bindings that fit: one broken entry or an action removed in an update must not cost the DJ the whole mapping. */
const validBindings = (raw: unknown): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(isRecord(raw) ? raw : {}).filter(
      ([action, control]) =>
        (MIDI_ACTIONS as readonly string[]).includes(action) &&
        midiControlSchema.safeParse(control).success,
    ),
  );

export const midiBindingsSchema = z.preprocess(
  validBindings,
  z.partialRecord(z.enum(MIDI_ACTIONS), midiControlSchema),
);
export type MidiBindings = z.output<typeof midiBindingsSchema>;

/** A CC counts as pressed from this value on (buttons that send CCs send 127 / 0). */
const CC_PRESSED = 64;
const isPress = (event: MidiEvent): boolean =>
  event.kind === 'note' ? event.value > 0 : event.value >= CC_PRESSED;

const controlOf = ({ kind, channel, number }: MidiEvent): MidiControl => ({
  kind,
  channel,
  number,
});

/**
 * The control to bind when `event` arrives while learning `action`, or null to keep waiting:
 * continuous actions need a knob or fader (CC), triggers a press (releases are ignored).
 */
export function learnedControl(action: MidiAction, event: MidiEvent): MidiControl | null {
  if (isContinuous(action)) return event.kind === 'cc' ? controlOf(event) : null;
  return isPress(event) ? controlOf(event) : null;
}

/** Binds `control` to `action`. A control does one thing only: other actions lose it. */
export function bind(
  bindings: MidiBindings,
  action: MidiAction,
  control: MidiControl,
): MidiBindings {
  const next: MidiBindings = {};
  for (const other of MIDI_ACTIONS) {
    const bound = bindings[other];
    if (bound && !sameControl(bound, control)) next[other] = bound;
  }
  next[action] = control;
  return next;
}

export function unbind(bindings: MidiBindings, action: MidiAction): MidiBindings {
  const { [action]: _removed, ...rest } = bindings;
  return rest;
}

export interface MidiCommand {
  action: MidiAction;
  effect: MidiEffect;
  /** The control's level, 0..1. */
  level: number;
}

/**
 * Turns MIDI messages into actions. Triggers fire once per press: on note on, or when a CC
 * crosses into the pressed range (it remembers the last value of each CC for that). Continuous
 * actions follow every move of their CC.
 */
export class MidiRouter {
  private readonly ccValues = new Map<string, number>();

  route(event: MidiEvent, bindings: MidiBindings): MidiCommand | null {
    const wasPressed = event.kind === 'cc' && this.rememberCc(event) >= CC_PRESSED;
    const action = MIDI_ACTIONS.find((candidate) => {
      const bound = bindings[candidate];
      return bound !== undefined && sameControl(bound, event);
    });
    if (!action) return null;

    const { effect } = MIDI_ACTION_INFO[action];
    const level = event.value / 127;
    if (effect.type === 'level') return event.kind === 'cc' ? { action, effect, level } : null;
    return isPress(event) && !wasPressed ? { action, effect, level } : null;
  }

  /** Stores the CC's new value and returns its previous one. */
  private rememberCc(event: MidiEvent): number {
    const key = `${event.channel}:${event.number}`;
    const previous = this.ccValues.get(key) ?? 0;
    this.ccValues.set(key, event.value);
    return previous;
  }
}
