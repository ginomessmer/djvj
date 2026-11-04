import { z } from 'zod';
import { OVERLAY_MODES } from './overlay-scheduler';
import { TEXT_STYLE_CHOICES, textMessagesSchema } from './texts';

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
  /** Shifts the beat grid to compensate audio and display latency: positive = beats earlier. */
  beatOffsetMs: z.number().min(-150).max(150),
  /** Auto mode also changes the palette (on drops and every few phrases). Picking one locks it. */
  autoPalette: z.boolean(),
  /** Lower the resolution automatically when frames get slow. */
  adaptiveResolution: z.boolean(),
  overlayMode: z.enum(OVERLAY_MODES),
  /** DJ name for the overlay (the logo is stored separately: it is too big for every update). */
  overlayName: z.string().max(40),
  /** Texts that appear with the music: each belongs to a moment (drop, build-up, ...). */
  texts: textMessagesSchema,
  /** Texts on or off as a whole (the list is kept). */
  textsOn: z.boolean(),
  /** 'auto': each scene brings its own text style. */
  textStyle: z.enum(TEXT_STYLE_CHOICES),
  /** Use a camera for the camera scenes. Off until the DJ turns it on (it asks for permission). */
  cameraEnabled: z.boolean(),
  /** '' = an iPhone via Continuity Camera if there is one, else the system default. */
  cameraDeviceId: z.string(),
  /** Mirror the camera like a selfie. Off: the audience sees the booth the right way round. */
  cameraMirror: z.boolean(),
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
  beatOffsetMs: 0,
  autoPalette: true,
  adaptiveResolution: true,
  overlayMode: 'off',
  overlayName: '',
  texts: [],
  textsOn: true,
  textStyle: 'auto',
  cameraEnabled: false,
  cameraDeviceId: '',
  cameraMirror: false,
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
