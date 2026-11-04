import { describe, expect, it } from 'vitest';
import type { TextFrame } from './text-director';
import { type TextMusic, textLook } from './text-motion';
import { splitGlyphs } from './texts';

const QUIET: TextMusic = { pulse: 0, beatPhase: 0.5, highs: 0 };

function frame(overrides: Partial<TextFrame>): TextFrame {
  return {
    content: { kind: 'text', text: 'HELLO' },
    serial: 1,
    style: 'neon',
    motion: 'slam',
    beats: 0,
    exit: 0,
    ...overrides,
  };
}

describe('textLook', () => {
  it('draws nothing without a text', () => {
    expect(textLook(frame({ content: null }), 5, QUIET).opacity).toBe(0);
  });

  it('has one lift and alpha per letter', () => {
    for (const motion of ['slam', 'type', 'drift', 'wave'] as const) {
      const look = textLook(frame({ motion, beats: 3 }), 7, QUIET);
      expect(look.lift).toHaveLength(7);
      expect(look.alpha).toHaveLength(7);
    }
  });

  it('slams in big with colour fringes and settles within a beat', () => {
    const start = textLook(frame({ beats: 0.02 }), 5, QUIET);
    expect(start.scale).toBeGreaterThan(1.7);
    expect(start.split).toBeGreaterThan(0.9);
    const settled = textLook(frame({ beats: 2 }), 5, QUIET);
    expect(settled.scale).toBeCloseTo(1, 2);
    expect(settled.split).toBe(0);
    expect(settled.opacity).toBe(1);
  });

  it('pumps on the beat without flashing: size and glow move, opacity does not', () => {
    const off = textLook(frame({ beats: 4 }), 5, QUIET);
    const on = textLook(frame({ beats: 4 }), 5, { ...QUIET, pulse: 1 });
    expect(on.scale).toBeGreaterThan(off.scale);
    expect(on.glow).toBeGreaterThan(off.glow);
    expect(on.opacity).toBe(off.opacity);
  });

  it('types the letters out in order, within 8 beats', () => {
    const look = (beats: number) => textLook(frame({ motion: 'type', beats }), 20, QUIET);
    const shownLetters = (beats: number) => look(beats).alpha.filter((a) => a >= 1).length;
    expect(shownLetters(0.15)).toBe(1);
    expect(shownLetters(3)).toBeGreaterThan(5);
    expect(look(3).alpha[0]).toBe(1);
    expect(look(3).alpha[19]).toBe(0);
    expect(shownLetters(8.2)).toBe(20);
  });

  it('builds tension in a long build-up: bigger, shakier with the riser', () => {
    const early = textLook(frame({ motion: 'type', beats: 4 }), 6, { ...QUIET, highs: 1 });
    const late = textLook(frame({ motion: 'type', beats: 30 }), 6, { ...QUIET, highs: 1 });
    expect(late.scale).toBeGreaterThan(early.scale);
    expect(late.shake).toBeGreaterThan(0.8);
    const lateCalm = textLook(frame({ motion: 'type', beats: 30 }), 6, QUIET);
    expect(lateCalm.shake).toBeLessThan(late.shake);
  });

  it('drifts in slowly over bars', () => {
    const early = textLook(frame({ motion: 'drift', beats: 1 }), 6, QUIET);
    const later = textLook(frame({ motion: 'drift', beats: 8 }), 6, QUIET);
    expect(early.opacity).toBeLessThan(0.2);
    expect(later.opacity).toBe(1);
    expect(later.shake).toBe(0);
  });

  it('rises in from below in a wave, then bounces the letters one after another', () => {
    const rising = textLook(frame({ motion: 'wave', beats: 0.1 }), 10, QUIET);
    expect(rising.lift[0]).toBeLessThan(0);
    const onBeat = textLook(frame({ motion: 'wave', beats: 6 }), 10, { ...QUIET, beatPhase: 0 });
    expect(onBeat.lift[0]).toBeGreaterThan(onBeat.lift[9]);
    const later = textLook(frame({ motion: 'wave', beats: 6 }), 10, { ...QUIET, beatPhase: 0.45 });
    expect(later.lift[9]).toBeGreaterThan(later.lift[0]);
  });

  it('dissolves and fades out as it leaves', () => {
    const leaving = textLook(frame({ beats: 16, exit: 0.5 }), 5, QUIET);
    expect(leaving.dissolve).toBe(0.5);
    expect(leaving.opacity).toBe(1);
    expect(textLook(frame({ beats: 17, exit: 1 }), 5, QUIET).opacity).toBe(0);
  });

  it('keeps every value in a sane range', () => {
    for (const motion of ['slam', 'type', 'drift', 'wave'] as const) {
      for (let beats = 0; beats < 64; beats += 0.37) {
        const look = textLook(frame({ motion, beats }), 12, { pulse: 1, beatPhase: 0.1, highs: 1 });
        for (const value of [look.opacity, look.shake, look.split, look.glow, ...look.alpha]) {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(1);
        }
        expect(look.scale).toBeLessThan(2);
        for (const lift of look.lift) expect(Math.abs(lift)).toBeLessThan(0.3);
      }
    }
  });
});

describe('splitGlyphs', () => {
  it('splits by what the eye sees as one letter', () => {
    expect(splitGlyphs('HI!')).toEqual(['H', 'I', '!']);
    expect(splitGlyphs('👍🏽 GO')).toHaveLength(4);
    expect(splitGlyphs('')).toEqual([]);
  });
});
