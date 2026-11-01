/** sRGB channel value 0..255 to linear light 0..1. */
function toLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Mean relative luminance (0..1, WCAG definition) of RGBA pixels. */
export function meanRelativeLuminance(rgba: ArrayLike<number>): number {
  let sum = 0;
  const pixels = Math.floor(rgba.length / 4);
  for (let i = 0; i < pixels * 4; i += 4) {
    sum +=
      0.2126 * toLinear(rgba[i]) + 0.7152 * toLinear(rgba[i + 1]) + 0.0722 * toLinear(rgba[i + 2]);
  }
  return pixels > 0 ? sum / pixels : 0;
}
