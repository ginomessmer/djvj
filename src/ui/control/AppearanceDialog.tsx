import {
  ACCENT_PRESETS,
  type Preferences,
  THEME_LABELS,
  THEMES,
  type Theme,
} from '@/domain/ui/preferences';
import { Dialog } from '../components/Dialog';

interface AppearanceDialogProps {
  open: boolean;
  preferences: Preferences;
  onChange: (patch: Partial<Preferences>) => void;
  onReset: () => void;
  onClose: () => void;
}

const THEME_HINTS: Record<Theme, string> = {
  dark: 'Easy on the eyes in a dark club.',
  light: 'For daylight sets and bright stages.',
  contrast: 'Maximum contrast and heavier outlines for glare.',
};

export function AppearanceDialog({
  open,
  preferences,
  onChange,
  onReset,
  onClose,
}: AppearanceDialogProps) {
  const isPreset = ACCENT_PRESETS.some((preset) => preset.color === preferences.accent);

  return (
    <Dialog open={open} title="Appearance" onClose={onClose}>
      <p class="hint">Only changes this control window. The big screen is not affected.</p>

      <fieldset class="choice">
        <legend>Theme</legend>
        <div class="choice__row">
          {THEMES.map((theme) => (
            <label key={theme} class="choice__option">
              <input
                type="radio"
                name="theme"
                value={theme}
                checked={preferences.theme === theme}
                onChange={() => onChange({ theme })}
              />
              <span>{THEME_LABELS[theme]}</span>
            </label>
          ))}
        </div>
        <p class="hint">{THEME_HINTS[preferences.theme]}</p>
      </fieldset>

      <fieldset class="choice">
        <legend>Accent colour</legend>
        <div class="choice__row">
          {ACCENT_PRESETS.map((preset) => (
            <label key={preset.id} class="accent-option">
              <input
                type="radio"
                name="accent"
                value={preset.color}
                checked={preferences.accent === preset.color}
                onChange={() => onChange({ accent: preset.color })}
              />
              <span class="accent-option__chip" style={{ background: preset.color }} />
              <span class="sr-only">{preset.name}</span>
            </label>
          ))}
          <label class={isPreset ? 'accent-custom' : 'accent-custom accent-custom--active'}>
            <span>Custom</span>
            <input
              type="color"
              value={preferences.accent}
              onInput={(event) => onChange({ accent: event.currentTarget.value })}
            />
          </label>
        </div>
        <p class="hint">
          Text on the accent colour switches between black and white automatically, and accent text
          is lightened or darkened where needed to stay readable.
        </p>
      </fieldset>

      <div class="dialog__footer">
        <button type="button" onClick={onReset}>
          Reset to defaults
        </button>
      </div>
    </Dialog>
  );
}
