import { describe, expect, it } from 'vitest';
import { contrastRatio, inkFor } from './color';
import {
  ACCENT_PRESETS,
  DEFAULT_PREFERENCES,
  parseStoredPreferences,
  THEME_LABELS,
  THEMES,
} from './preferences';

describe('parseStoredPreferences', () => {
  it('keeps valid values and normalises the accent to lower case', () => {
    expect(parseStoredPreferences({ theme: 'light', accent: '#00C8F0' })).toEqual({
      theme: 'light',
      accent: '#00c8f0',
    });
  });

  it('falls back per field, never as a whole', () => {
    expect(parseStoredPreferences({ theme: 'neon', accent: '#00c8f0' })).toEqual({
      theme: DEFAULT_PREFERENCES.theme,
      accent: '#00c8f0',
    });
    expect(parseStoredPreferences({ theme: 'contrast', accent: 'pink' })).toEqual({
      theme: 'contrast',
      accent: DEFAULT_PREFERENCES.accent,
    });
  });

  it('survives garbage', () => {
    for (const raw of [null, undefined, 42, 'x', [], {}]) {
      expect(parseStoredPreferences(raw)).toEqual(DEFAULT_PREFERENCES);
    }
  });
});

describe('presets', () => {
  it('has a label for every theme and distinct accents', () => {
    expect(Object.keys(THEME_LABELS).sort()).toEqual([...THEMES].sort());
    expect(new Set(ACCENT_PRESETS.map((preset) => preset.color)).size).toBe(ACCENT_PRESETS.length);
  });

  it('every preset takes readable text on top of it', () => {
    for (const { color, name } of ACCENT_PRESETS) {
      expect(contrastRatio(color, inkFor(color)), name).toBeGreaterThanOrEqual(4.5);
    }
  });
});
