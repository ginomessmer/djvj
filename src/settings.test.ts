import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, sanitizeSettings } from './settings';
import { PALETTES, findPalette, hexToRgb, nextPalette, paletteToUniform } from './palettes';

describe('sanitizeSettings', () => {
  it('returns defaults for garbage', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings('nope')).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({ intensity: 'loud', auto: 1, deviceId: 5 })).toEqual(DEFAULT_SETTINGS);
  });

  it('clamps numeric values into their legal range', () => {
    const s = sanitizeSettings({ intensity: 7, renderScale: 0, silenceDb: -500 });
    expect(s.intensity).toBe(1);
    expect(s.renderScale).toBe(0.25);
    expect(s.silenceDb).toBe(-80);
  });

  it('keeps valid values', () => {
    const s = sanitizeSettings({ deviceId: 'abc', intensity: 0.5, auto: false, paletteId: 'ice' });
    expect(s).toMatchObject({ deviceId: 'abc', intensity: 0.5, auto: false, paletteId: 'ice' });
  });
});

describe('palettes', () => {
  it('parses hex colours', () => {
    expect(hexToRgb('#ff0000')).toEqual([1, 0, 0]);
    expect(hexToRgb('00ff00')).toEqual([0, 1, 0]);
    expect(hexToRgb('nonsense')).toEqual([0, 0, 0]);
  });

  it('builds a vec3[4] uniform and has valid colours everywhere', () => {
    for (const p of PALETTES) {
      expect(paletteToUniform(p)).toHaveLength(12);
      for (const hex of p.colors) expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('falls back to the first palette and cycles', () => {
    expect(findPalette('does-not-exist')).toBe(PALETTES[0]);
    const last = PALETTES[PALETTES.length - 1]!;
    expect(nextPalette(last.id)).toBe(PALETTES[0]);
  });
});
