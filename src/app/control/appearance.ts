import { ensureContrast, inkFor } from '@/domain/ui/color';
import type { Preferences } from '@/domain/ui/preferences';

/** Text and outlines in the accent colour must stay at least this readable on a surface. */
const ACCENT_TEXT_CONTRAST = 4.5;

/**
 * Applies the theme and the accent colour to the page. Themes live in CSS; the accent is a
 * runtime value, so it is derived here: the pure colour as fill, black or white for text on it,
 * and a version nudged until it is readable as text on the current surface.
 */
export function applyPreferences({ theme, accent }: Preferences): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  const surface = getComputedStyle(root).getPropertyValue('--surface').trim();
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--accent-ink', inkFor(accent));
  root.style.setProperty('--accent-fg', ensureContrast(accent, surface, ACCENT_TEXT_CONTRAST));
}
