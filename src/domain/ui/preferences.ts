import { z } from 'zod';
import { isHexColor } from './color';

/**
 * How the control window looks. Kept apart from the show settings on purpose: it only concerns
 * the screen in front of the DJ, never the output, and each browser can have its own.
 */
export const THEMES = ['dark', 'light', 'contrast'] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_LABELS: Record<Theme, string> = {
  dark: 'Dark',
  light: 'Light',
  contrast: 'High contrast',
};

export interface AccentPreset {
  id: string;
  name: string;
  color: string;
}

export const ACCENT_PRESETS: readonly AccentPreset[] = [
  { id: 'magenta', name: 'Magenta', color: '#ff2e97' },
  { id: 'cyan', name: 'Cyan', color: '#00c8f0' },
  { id: 'lime', name: 'Lime', color: '#a6e600' },
  { id: 'amber', name: 'Amber', color: '#ffb020' },
  { id: 'violet', name: 'Violet', color: '#9b6bff' },
  { id: 'red', name: 'Red', color: '#ff4d5e' },
];

export const preferenceFields = {
  theme: z.enum(THEMES),
  /** `#rrggbb`. Any colour is accepted; the UI keeps text readable on top of it. */
  accent: z.string().refine(isHexColor),
};

export type Preferences = z.infer<z.ZodObject<typeof preferenceFields>>;

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'dark',
  accent: ACCENT_PRESETS[0].color,
};

/** Reads whatever came out of storage; every field falls back to its default on its own. */
export function parseStoredPreferences(raw: unknown): Preferences {
  const stored = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const theme = preferenceFields.theme.safeParse(stored.theme);
  const accent = preferenceFields.accent.safeParse(stored.accent);
  return {
    theme: theme.success ? theme.data : DEFAULT_PREFERENCES.theme,
    accent: accent.success ? accent.data.toLowerCase() : DEFAULT_PREFERENCES.accent,
  };
}
