import { z } from 'zod';

/**
 * How headline text looks. Every scene has one that suits it (`SceneInfo.textStyle`); the DJ can
 * force one instead.
 * - neon: glowing palette tubes along the outline, the halo pumps on the beat
 * - chrome: retro metal gradient with a horizon line and a highlight that sweeps on the beat
 * - glass: the letters refract the scene behind them
 * - soft: light, airy letters in a wide glow, for calm scenes
 * - glitch: RGB split and slipping slices on the bass
 * - invert: the letters invert the scene behind them
 */
export const TEXT_STYLES = ['neon', 'chrome', 'glass', 'soft', 'glitch', 'invert'] as const;
export type TextStyle = (typeof TEXT_STYLES)[number];

/** 'auto' follows the scene on screen. */
export const TEXT_STYLE_CHOICES = ['auto', ...TEXT_STYLES] as const;
export type TextStyleChoice = (typeof TEXT_STYLE_CHOICES)[number];

/** The moment a text belongs to; it also decides how the text moves. */
export const TEXT_CUES = ['drop', 'build', 'breakdown', 'groove'] as const;
export type TextCue = (typeof TEXT_CUES)[number];

export const MAX_TEXTS = 8;
export const MAX_TEXT_LENGTH = 40;

export const textMessageSchema = z.object({
  text: z.string().max(MAX_TEXT_LENGTH),
  cue: z.enum(TEXT_CUES),
});
export type TextMessage = z.infer<typeof textMessageSchema>;

export const textMessagesSchema = z.array(textMessageSchema).max(MAX_TEXTS);

const segmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

/**
 * The letters of a text as the eye sees them (an emoji with modifiers is one). Letters animate
 * one by one; the domain and the renderer must agree on how many there are.
 */
export function splitGlyphs(text: string): string[] {
  if (!segmenter) return Array.from(text);
  return Array.from(segmenter.segment(text), (part) => part.segment);
}

/** Styles that set their text in capitals (glass keeps the case as typed). */
const UPPERCASE: Record<TextStyle, boolean> = {
  neon: true,
  chrome: true,
  glass: false,
  soft: true,
  glitch: true,
  invert: true,
};

/** The text as a style draws it. Capitals can change the letter count ("ß" → "SS"). */
export const displayText = (text: string, style: TextStyle): string =>
  UPPERCASE[style] ? text.toUpperCase() : text;

/** How many letters animate one by one; longer texts move as one block from there on. */
export function glyphCount(
  content: { kind: 'text'; text: string } | { kind: 'mark' },
  style: TextStyle,
): number {
  if (content.kind === 'mark') return 1;
  return Math.min(MAX_TEXT_LENGTH, splitGlyphs(displayText(content.text, style)).length);
}
