import { describe, expect, it } from 'vitest';
import { describeControl, describeEvent, parseMidi, sameControl } from './midi-message';

describe('parseMidi', () => {
  it('reads note on, note off and control change with their channel', () => {
    expect(parseMidi([0x97, 0x24, 0x7f])).toEqual({
      kind: 'note',
      channel: 7,
      number: 36,
      value: 127,
    });
    expect(parseMidi([0x87, 0x24, 0x40])).toEqual({
      kind: 'note',
      channel: 7,
      number: 36,
      value: 0,
    });
    expect(parseMidi([0xb0, 0x13, 0x40])).toEqual({
      kind: 'cc',
      channel: 0,
      number: 19,
      value: 64,
    });
  });

  it('treats note on with velocity 0 as a release', () => {
    expect(parseMidi([0x90, 0x24, 0x00])?.value).toBe(0);
  });

  it('ignores clock, SysEx, pitch bend and short messages', () => {
    expect(parseMidi([0xf8])).toBeNull();
    expect(parseMidi([0xf0, 0x00, 0x40, 0xf7])).toBeNull();
    expect(parseMidi([0xe0, 0x00, 0x40])).toBeNull();
    expect(parseMidi([0x90, 0x24])).toBeNull();
  });

  it('masks out-of-range data bytes', () => {
    expect(parseMidi([0xb0, 0xff, 0xff])).toMatchObject({ number: 127, value: 127 });
  });
});

describe('controls', () => {
  it('compares kind, channel and number', () => {
    const pad = { kind: 'note', channel: 7, number: 36 } as const;
    expect(sameControl(pad, { ...pad })).toBe(true);
    expect(sameControl(pad, { ...pad, kind: 'cc' })).toBe(false);
    expect(sameControl(pad, { ...pad, channel: 8 })).toBe(false);
    expect(sameControl(pad, { ...pad, number: 37 })).toBe(false);
  });

  it('describes channels from 1, as controller manuals do', () => {
    expect(describeControl({ kind: 'cc', channel: 0, number: 19 })).toBe('CC 19 · ch 1');
    expect(describeEvent({ kind: 'note', channel: 7, number: 36, value: 127 })).toBe(
      'Note 36 · ch 8 = 127',
    );
  });
});
