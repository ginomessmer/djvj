/** Colour maths for the control UI: parsing, WCAG contrast, and keeping text readable. */

export type Rgb = readonly [red: number, green: number, blue: number];

const HEX_PATTERN = /^#([0-9a-f]{6})$/i;
/** CSS minifiers write `#ffffff` as `#fff`, and colours are read back from computed CSS. */
const SHORT_HEX_PATTERN = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i;

/** Exactly `#rrggbb`, the form stored for the accent colour. */
export function isHexColor(value: string): boolean {
  return HEX_PATTERN.test(value);
}

/** `#rrggbb` or `#rgb` (any case) to 0..255 channels, or null for anything else. */
export function parseHex(hex: string): Rgb | null {
  const trimmed = hex.trim();
  const short = SHORT_HEX_PATTERN.exec(trimmed);
  const match = short
    ? [
        trimmed,
        short
          .slice(1)
          .map((d) => d + d)
          .join(''),
      ]
    : HEX_PATTERN.exec(trimmed);
  if (!match) return null;
  const value = Number.parseInt(match[1], 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

export function toHex([red, green, blue]: Rgb): string {
  const channel = (value: number) =>
    Math.round(Math.min(255, Math.max(0, value)))
      .toString(16)
      .padStart(2, '0');
  return `#${channel(red)}${channel(green)}${channel(blue)}`;
}

/** WCAG 2.x relative luminance, 0 (black) .. 1 (white). */
export function relativeLuminance([red, green, blue]: Rgb): number {
  const linear = (channel: number) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

/** WCAG contrast ratio, 1 (identical) .. 21 (black on white). Invalid colours count as 1. */
export function contrastRatio(a: string, b: string): number {
  const first = parseHex(a);
  const second = parseHex(b);
  if (!first || !second) return 1;
  const [light, dark] = [relativeLuminance(first), relativeLuminance(second)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

const BLACK = '#000000';
const WHITE = '#ffffff';

/** Black or white, whichever reads better on `background` (text on an accent-coloured button). */
export function inkFor(background: string): string {
  return contrastRatio(background, BLACK) >= contrastRatio(background, WHITE) ? BLACK : WHITE;
}

/**
 * Nudges `color` towards white or black (whichever helps) until it reaches `minRatio` against
 * `background`, keeping its hue. Used so a user-picked accent stays legible as text and outline.
 * Returns `color` unchanged when it already passes.
 */
export function ensureContrast(color: string, background: string, minRatio: number): string {
  const rgb = parseHex(color);
  if (!rgb || contrastRatio(color, background) >= minRatio) return color;

  const towardWhite = contrastRatio(WHITE, background) >= contrastRatio(BLACK, background);
  const target: Rgb = towardWhite ? [255, 255, 255] : [0, 0, 0];
  let best = color;
  for (let step = 1; step <= 20; step++) {
    const amount = step / 20;
    best = toHex(rgb.map((value, i) => value + (target[i] - value) * amount) as unknown as Rgb);
    if (contrastRatio(best, background) >= minRatio) return best;
  }
  return best;
}
