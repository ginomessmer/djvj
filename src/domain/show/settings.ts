import { z } from 'zod';

/** Settings that survive a reload. Single source of truth for their type, range and default. */
export const settingsFields = {
  deviceId: z.string(),
  /** Master brightness. */
  intensity: z.number().min(0).max(1),
  /** Pixel budget relative to 1080p: 1 = 1920x1080 pixels, lower = lighter on the GPU. */
  renderScale: z.number().min(0.25).max(2),
  auto: z.boolean(),
  paletteId: z.string(),
  /** Input quieter than this (dBFS) counts as silence. */
  silenceDb: z.number().min(-80).max(-20),
};

export const settingsSchema = z.object(settingsFields);
export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  deviceId: '',
  intensity: 1,
  renderScale: 1,
  auto: true,
  paletteId: 'synthwave',
  silenceDb: -52,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as Array<keyof Settings>;

/**
 * Reads whatever came out of storage. Storage can be stale or corrupted, so each field is checked
 * on its own: valid ones are kept, everything else falls back to its default.
 */
export function parseStoredSettings(raw: unknown): Settings {
  const stored = isRecord(raw) ? raw : {};
  const entries = SETTING_KEYS.map((key) => {
    const parsed = settingsFields[key].safeParse(stored[key]);
    return [key, parsed.success ? parsed.data : DEFAULT_SETTINGS[key]];
  });
  return Object.fromEntries(entries) as Settings;
}
