import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, parseStoredSettings } from './settings';
import { showPatchSchema } from './show-state';

describe('parseStoredSettings', () => {
  it('returns defaults for garbage', () => {
    expect(parseStoredSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseStoredSettings('nope')).toEqual(DEFAULT_SETTINGS);
    expect(parseStoredSettings({ intensity: 'loud', auto: 1, deviceId: 5 })).toEqual(
      DEFAULT_SETTINGS,
    );
  });

  it('keeps valid fields and defaults only the broken ones', () => {
    const settings = parseStoredSettings({
      deviceId: 'abc',
      intensity: 0.5,
      auto: false,
      silenceDb: -500,
    });
    expect(settings).toMatchObject({ deviceId: 'abc', intensity: 0.5, auto: false });
    expect(settings.silenceDb).toBe(DEFAULT_SETTINGS.silenceDb); // out of range
  });
});

describe('showPatchSchema', () => {
  it('accepts partial, valid patches', () => {
    expect(showPatchSchema.safeParse({ intensity: 0.4 }).success).toBe(true);
    expect(showPatchSchema.safeParse({ sceneId: 'rings', auto: false }).success).toBe(true);
    expect(showPatchSchema.safeParse({}).success).toBe(true);
  });

  it('validates the overlay settings', () => {
    expect(
      showPatchSchema.safeParse({ overlayMode: 'reveal', overlayName: 'DJ Gino' }).success,
    ).toBe(true);
    expect(showPatchSchema.safeParse({ overlayMode: 'blink' }).success).toBe(false);
    expect(showPatchSchema.safeParse({ overlayName: 'x'.repeat(41) }).success).toBe(false);
  });

  it('rejects out-of-range values and unknown scenes', () => {
    expect(showPatchSchema.safeParse({ intensity: 5 }).success).toBe(false);
    expect(showPatchSchema.safeParse({ renderScale: 0 }).success).toBe(false);
    expect(showPatchSchema.safeParse({ sceneId: 'does-not-exist' }).success).toBe(false);
    expect(showPatchSchema.safeParse({ panic: 'yes' }).success).toBe(false);
  });
});
