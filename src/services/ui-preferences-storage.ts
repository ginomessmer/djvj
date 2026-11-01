import {
  DEFAULT_PREFERENCES,
  type Preferences,
  parseStoredPreferences,
} from '@/domain/ui/preferences';

export const PREFERENCES_KEY = 'djvj.ui';

/** Missing, blocked or corrupted storage just means the defaults. */
export function loadPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(PREFERENCES_KEY);
    return raw ? parseStoredPreferences(JSON.parse(raw)) : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(preferences: Preferences): void {
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // Private window or full storage: the choice only lasts until the page is closed.
  }
}
