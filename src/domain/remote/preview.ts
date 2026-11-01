/** A small copy of what the output shows, for the preview pane of the control window. */
export interface PreviewFrame {
  width: number;
  height: number;
  /** RGBA, top row first, `width * height * 4` bytes. */
  pixels: Uint8ClampedArray;
}

/** Width of the preview. The height follows the output's aspect ratio. */
export const PREVIEW_WIDTH = 256;
/** The output only sends frames this often, and only while a control window is watching. */
export const PREVIEW_INTERVAL_SEC = 0.1;
/** A control window must ask again within this time, or the output stops producing frames. */
export const PREVIEW_WATCH_SEC = 3;

export function previewHeight(outputWidth: number, outputHeight: number): number {
  if (outputWidth <= 0 || outputHeight <= 0) return Math.round((PREVIEW_WIDTH * 9) / 16);
  return Math.max(2, Math.round((PREVIEW_WIDTH * outputHeight) / outputWidth));
}

/** GPU read-backs come bottom row first; the canvas wants the top row first. */
export function flipRows(pixels: Uint8Array, width: number, height: number): Uint8ClampedArray {
  const stride = width * 4;
  const flipped = new Uint8ClampedArray(stride * height);
  for (let row = 0; row < height; row++) {
    const from = (height - 1 - row) * stride;
    flipped.set(pixels.subarray(from, from + stride), row * stride);
  }
  return flipped;
}
