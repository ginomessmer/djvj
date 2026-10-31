import { describe, expect, it } from 'vitest';
import { findPalette, nextPalette, PALETTES } from './palettes';

describe('palettes', () => {
  it('has four valid hex colours each', () => {
    for (const palette of PALETTES) {
      expect(palette.colors).toHaveLength(4);
      for (const hex of palette.colors) expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('falls back to the first palette and cycles', () => {
    expect(findPalette('does-not-exist')).toBe(PALETTES[0]);
    expect(nextPalette(PALETTES[PALETTES.length - 1].id)).toBe(PALETTES[0]);
  });
});
