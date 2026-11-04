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

  it('keeps the camera presence within 0..1', () => {
    expect(parseStoredSettings({ cameraPresence: 0.8 }).cameraPresence).toBe(0.8);
    expect(parseStoredSettings({ cameraPresence: 3 }).cameraPresence).toBe(
      DEFAULT_SETTINGS.cameraPresence,
    );
  });
});

describe('showPatchSchema', () => {
  it('accepts partial, valid patches', () => {
    expect(showPatchSchema.safeParse({ intensity: 0.4 }).success).toBe(true);
    expect(showPatchSchema.safeParse({ sceneId: 'rings', auto: false }).success).toBe(true);
    expect(showPatchSchema.safeParse({}).success).toBe(true);
  });

  it('validates the texts and their images', () => {
    const image = { text: 'logo.png', cue: 'drop', imageId: 'a1b2-c3' };
    expect(showPatchSchema.safeParse({ texts: [{ text: 'HI', cue: 'drop' }, image] }).success).toBe(
      true,
    );
    expect(showPatchSchema.safeParse({ texts: [{ text: 'HI', cue: 'blink' }] }).success).toBe(
      false,
    );
    expect(showPatchSchema.safeParse({ texts: [{ ...image, imageId: '../x' }] }).success).toBe(
      false,
    );
    const nine = Array.from({ length: 9 }, () => ({ text: 'x', cue: 'drop' }));
    expect(showPatchSchema.safeParse({ texts: nine }).success).toBe(false);
  });

  it('rejects out-of-range values and unknown scenes', () => {
    expect(showPatchSchema.safeParse({ intensity: 5 }).success).toBe(false);
    expect(showPatchSchema.safeParse({ renderScale: 0 }).success).toBe(false);
    expect(showPatchSchema.safeParse({ sceneId: 'does-not-exist' }).success).toBe(false);
    expect(showPatchSchema.safeParse({ panic: 'yes' }).success).toBe(false);
  });
});
