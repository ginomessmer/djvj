import { createJSONStorage, persist, subscribeWithSelector } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';
import { parseStoredSettings, settingsSchema } from '@/domain/show/settings';
import { INITIAL_SHOW_STATE, type ShowState, showPatchSchema } from '@/domain/show/show-state';

export const STORAGE_KEY = 'djvj.show';

export interface ShowStore extends ShowState {
  /** Validates and applies a partial update. Invalid patches (e.g. from the other window) are ignored. */
  apply(patch: unknown): void;
}

/**
 * The single source of truth for what the show is doing. Only the persistent settings are saved;
 * storage that is missing or corrupted just means defaults.
 */
export function createShowStore() {
  return createStore<ShowStore>()(
    subscribeWithSelector(
      persist(
        (set) => ({
          ...INITIAL_SHOW_STATE,
          apply: (patch) => {
            const parsed = showPatchSchema.safeParse(patch);
            if (parsed.success) set(parsed.data);
            else console.warn('[djvj] ignored invalid patch:', parsed.error.message);
          },
        }),
        {
          name: STORAGE_KEY,
          storage: createJSONStorage(() => localStorage),
          partialize: (state) => settingsSchema.parse(state),
          merge: (persisted, current) => ({ ...current, ...parseStoredSettings(persisted) }),
        },
      ),
    ),
  );
}

export type ShowStoreApi = ReturnType<typeof createShowStore>;

/** The state without the `apply` function: safe to send to another window. */
export function toShowState({ apply: _apply, ...show }: ShowStore): ShowState {
  return show;
}
