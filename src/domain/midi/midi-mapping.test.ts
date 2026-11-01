import { describe, expect, it } from 'vitest';
import {
  bind,
  learnedControl,
  MIDI_ACTIONS,
  type MidiBindings,
  MidiRouter,
  midiBindingsSchema,
  unbind,
} from './midi-mapping';
import type { MidiEvent } from './midi-message';

const PAD = { kind: 'note', channel: 7, number: 36 } as const;
const CC_BUTTON = { kind: 'cc', channel: 0, number: 80 } as const;
const KNOB = { kind: 'cc', channel: 0, number: 19 } as const;
const at = (control: typeof PAD | typeof CC_BUTTON | typeof KNOB, value: number): MidiEvent => ({
  ...control,
  value,
});

describe('learnedControl', () => {
  it('binds a trigger to the next press, not to a release', () => {
    expect(learnedControl('panic', at(PAD, 0))).toBeNull();
    expect(learnedControl('panic', at(PAD, 127))).toEqual(PAD);
    expect(learnedControl('tap', at(CC_BUTTON, 0))).toBeNull();
    expect(learnedControl('tap', at(CC_BUTTON, 127))).toEqual(CC_BUTTON);
  });

  it('binds a continuous action to a knob or fader only', () => {
    expect(learnedControl('brightness', at(PAD, 127))).toBeNull();
    expect(learnedControl('brightness', at(KNOB, 3))).toEqual(KNOB);
  });
});

describe('bind and unbind', () => {
  it('moves a control that was already bound: one control does one thing', () => {
    const bindings = bind(bind({}, 'panic', PAD), 'tap', KNOB);
    expect(bind(bindings, 'blackout', PAD)).toEqual({ tap: KNOB, blackout: PAD });
  });

  it('replaces the control of an action', () => {
    expect(bind({ panic: PAD }, 'panic', CC_BUTTON)).toEqual({ panic: CC_BUTTON });
  });

  it('unbinds one action and leaves the rest', () => {
    expect(unbind({ panic: PAD, tap: KNOB }, 'panic')).toEqual({ tap: KNOB });
  });

  it('keeps the valid bindings and drops broken or unknown ones', () => {
    const parsed = midiBindingsSchema.parse({
      panic: PAD,
      tap: { ...PAD, channel: 16 },
      blackout: { ...PAD, kind: 'sysex' },
      'removed-action': PAD,
    });
    expect(parsed).toEqual({ panic: PAD });
    expect(midiBindingsSchema.parse('garbage')).toEqual({});
  });
});

describe('MidiRouter', () => {
  const bindings: MidiBindings = { panic: PAD, tap: CC_BUTTON, brightness: KNOB };

  it('fires a trigger once per press', () => {
    const router = new MidiRouter();
    expect(router.route(at(PAD, 127), bindings)?.effect).toEqual({
      type: 'command',
      command: 'panic',
    });
    expect(router.route(at(PAD, 0), bindings)).toBeNull();
    expect(router.route(at(PAD, 100), bindings)?.action).toBe('panic');
  });

  it('fires a CC button when it crosses into the pressed range only', () => {
    const router = new MidiRouter();
    expect(router.route(at(CC_BUTTON, 127), bindings)?.effect).toEqual({ type: 'tap' });
    expect(router.route(at(CC_BUTTON, 120), bindings)).toBeNull();
    expect(router.route(at(CC_BUTTON, 0), bindings)).toBeNull();
    expect(router.route(at(CC_BUTTON, 127), bindings)?.action).toBe('tap');
  });

  it('follows every move of a knob, as a level from 0 to 1', () => {
    const router = new MidiRouter();
    const levels = [0, 64, 127].map((value) => router.route(at(KNOB, value), bindings)?.level);
    expect(levels).toEqual([0, 64 / 127, 1]);
    const patch = router.route(at(KNOB, 127), bindings);
    expect(patch?.effect.type === 'level' && patch.effect.patch(0.5)).toEqual({ intensity: 0.5 });
  });

  it('ignores unbound controls and the wrong channel', () => {
    const router = new MidiRouter();
    expect(router.route({ ...at(PAD, 127), channel: 6 }, bindings)).toBeNull();
    expect(
      router.route(at({ kind: 'cc', channel: 0, number: 1 } as never, 127), bindings),
    ).toBeNull();
  });

  it('has a label and an effect for every action', () => {
    expect(new Set(MIDI_ACTIONS).size).toBe(MIDI_ACTIONS.length);
  });
});
