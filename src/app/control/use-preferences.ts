import { useCallback, useEffect, useState } from 'preact/hooks';
import { DEFAULT_PREFERENCES, type Preferences } from '@/domain/ui/preferences';
import { loadPreferences, savePreferences } from '@/services/ui-preferences-storage';
import { applyPreferences } from './appearance';

/** Theme and accent colour of this control window, remembered per browser. */
export function usePreferences() {
  const [preferences, setPreferences] = useState<Preferences>(loadPreferences);

  useEffect(() => {
    applyPreferences(preferences);
    savePreferences(preferences);
  }, [preferences]);

  const update = useCallback(
    (patch: Partial<Preferences>) => setPreferences((current) => ({ ...current, ...patch })),
    [],
  );
  const reset = useCallback(() => setPreferences(DEFAULT_PREFERENCES), []);
  return { preferences, update, reset };
}
