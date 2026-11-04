import { clamp01, fract, smoothstep } from '../math';
import type { TextFrame } from './text-director';

/** What the music is doing right now, as far as text moves with it. */
export interface TextMusic {
  /** Beat-locked pulse 0..1 (already damped by the flash guard). */
  pulse: number;
  /** 0..1 position in the beat. */
  beatPhase: number;
  /** Highs 0..1: the riser of a build-up. */
  highs: number;
}

/** How the text is drawn this frame. Lengths and offsets are in text-box heights. */
export interface TextLook {
  /** Whole text, 0..1. */
  opacity: number;
  /** Size around the centre (1 = fits the box). */
  scale: number;
  /** Jitter, 0..1. */
  shake: number;
  /** Colour fringes, 0..1. */
  split: number;
  /** 0..1: noise eats the letters as the text leaves. */
  dissolve: number;
  /** Extra glow, 0..1, mostly from the beat. */
  glow: number;
  /** Per letter: how far it is lifted (positive = up). */
  lift: number[];
  /** Per letter: 0..1. */
  alpha: number[];
}

export const HIDDEN_LOOK: TextLook = {
  opacity: 0,
  scale: 1,
  shake: 0,
  split: 0,
  dissolve: 1,
  glow: 0,
  lift: [],
  alpha: [],
};

const easeOutCubic = (x: number): number => 1 - (1 - clamp01(x)) ** 3;
/** Overshoots a little before it settles: letters that land with a bounce. */
const easeOutBack = (x: number): number => {
  const t = clamp01(x) - 1;
  return 1 + 2.2 * t ** 3 + 1.2 * t ** 2;
};
/** A short bump right after x = 0 that decays, repeating every 1. */
const beatBump = (x: number): number => Math.exp(-7 * fract(x));

/**
 * Turns the text director's frame into numbers the renderer draws, letter by letter. Pure, so
 * every motion can be checked without a GPU. Nothing here flashes: the beat changes size, lift and
 * glow, never the text's brightness as a whole.
 */
export function textLook(frame: TextFrame, glyphCount: number, music: TextMusic): TextLook {
  if (!frame.content || glyphCount === 0) return HIDDEN_LOOK;
  const look = MOTIONS[frame.motion](frame.beats, glyphCount, music);
  look.dissolve = frame.exit;
  look.opacity *= 1 - smoothstep(0.6, 1, frame.exit);
  return look;
}

type Motion = (beats: number, count: number, music: TextMusic) => TextLook;

const filled = (count: number, value: number) => new Array<number>(count).fill(value);

/** The drop: everything at once, huge, with colour fringes, then it sits and pumps on the beat. */
const slam: Motion = (beats, count, { pulse }) => {
  const landed = easeOutCubic(beats / 0.5);
  return {
    opacity: clamp01(beats / 0.12),
    scale: 1 + 0.9 * (1 - landed) + 0.035 * pulse,
    shake: 0.5 * (1 - clamp01(beats / 1)),
    split: Math.max(1 - clamp01(beats / 1.5), 0.25 * pulse),
    dissolve: 0,
    glow: pulse,
    lift: filled(count, 0),
    alpha: filled(count, 1),
  };
};

/**
 * The build-up: typed out letter by letter on the grid, then it grows and shakes harder as the
 * riser climbs, until the drop takes over.
 */
const type: Motion = (beats, count, { pulse, highs }) => {
  const step = Math.min(0.5, 8 / count); // all letters within 8 beats
  const typed = beats - (count - 1) * step;
  const tension = clamp01(typed / 24);
  const lift = filled(count, 0);
  const alpha = filled(count, 0);
  for (let i = 0; i < count; i++) {
    const age = beats - i * step;
    alpha[i] = clamp01(age / 0.1);
    lift[i] = 0.12 * (1 - easeOutCubic(age / 0.35));
  }
  return {
    opacity: 1,
    scale: 1 + 0.08 * tension,
    shake: tension * (0.3 + 0.7 * highs),
    split: 0.4 * tension * highs,
    dissolve: 0,
    glow: 0.3 * tension + 0.5 * pulse,
    lift,
    alpha,
  };
};

/** The breakdown: fades in over bars, letters one after another, swaying slowly. */
const drift: Motion = (beats, count) => {
  const lift = filled(count, 0);
  const alpha = filled(count, 0);
  for (let i = 0; i < count; i++) {
    alpha[i] = smoothstep(0, 4, beats - i * 0.35);
    lift[i] = 0.02 * Math.sin((2 * Math.PI * beats) / 8 - i * 0.5);
  }
  return {
    opacity: smoothstep(0, 6, beats),
    scale: 0.94 + 0.06 * smoothstep(0, 16, beats),
    shake: 0,
    split: 0,
    dissolve: 0,
    glow: 0.3 + 0.2 * Math.sin((2 * Math.PI * beats) / 8),
    lift,
    alpha,
  };
};

/**
 * The groove: letters rise in from left to right with a little bounce, then a wave runs across
 * them on every beat.
 */
const wave: Motion = (beats, count, { pulse, beatPhase }) => {
  const step = Math.min(0.12, 1.5 / count);
  const lift = filled(count, 0);
  const alpha = filled(count, 0);
  for (let i = 0; i < count; i++) {
    const age = beats - i * step;
    alpha[i] = clamp01(age / 0.2);
    const risen = easeOutBack(age / 0.6);
    const settled = clamp01((age - 0.6) / 0.5);
    lift[i] = -0.25 * (1 - risen) + 0.04 * settled * beatBump(beatPhase - (0.5 * i) / count);
  }
  return {
    opacity: 1,
    scale: 1 + 0.02 * pulse,
    shake: 0,
    split: 0,
    dissolve: 0,
    glow: 0.6 * pulse,
    lift,
    alpha,
  };
};

const MOTIONS: Record<TextFrame['motion'], Motion> = { slam, type, drift, wave };
