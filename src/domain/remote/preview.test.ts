import { describe, expect, it } from 'vitest';
import { flipRows, PREVIEW_WIDTH, previewHeight } from './preview';

describe('previewHeight', () => {
  it('follows the output aspect ratio', () => {
    expect(previewHeight(1920, 1080)).toBe(144);
    expect(previewHeight(1000, 1000)).toBe(PREVIEW_WIDTH);
    expect(previewHeight(2560, 1080)).toBe(108);
  });

  it('falls back to 16:9 before the output has a size', () => {
    expect(previewHeight(0, 0)).toBe(144);
  });
});

describe('flipRows', () => {
  it('puts the bottom row first', () => {
    // 2x3 image, one distinct byte value per pixel's red channel
    const rows = [
      [1, 0, 0, 255, 2, 0, 0, 255],
      [3, 0, 0, 255, 4, 0, 0, 255],
      [5, 0, 0, 255, 6, 0, 0, 255],
    ];
    const flipped = flipRows(new Uint8Array(rows.flat()), 2, 3);
    expect(Array.from(flipped)).toEqual([...rows[2], ...rows[1], ...rows[0]]);
  });

  it('keeps the size and does not touch the source', () => {
    const source = new Uint8Array(4 * 4 * 4).map((_, i) => i);
    const copy = Uint8Array.from(source);
    expect(flipRows(source, 4, 4)).toHaveLength(source.length);
    expect(source).toEqual(copy);
  });
});
