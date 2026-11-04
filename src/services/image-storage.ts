const PREFIX = 'djvj.image.';
/** Where the logo lived before images became list entries. */
const LEGACY_LOGO_KEY = 'djvj.logo';

export interface ImageStorage {
  /** Ids of every stored image. */
  ids(): string[];
  /** The image's data URL, or '' when there is none. */
  load(id: string): string;
  /** @returns false when it could not be stored (storage full or unavailable) */
  save(id: string, dataUrl: string): boolean;
  remove(id: string): void;
}

/**
 * Images of the text list, one storage key each: far too big to be rewritten with every settings
 * change or sent with every snapshot. Both windows share the origin, so the control window reads
 * thumbnails from here; only the output window writes. Storage problems mean no image, never a
 * crash.
 */
export const imageStorage: ImageStorage = {
  ids: () => {
    try {
      const ids: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(PREFIX)) ids.push(key.slice(PREFIX.length));
      }
      return ids;
    } catch {
      return [];
    }
  },
  load: (id) => {
    try {
      return localStorage.getItem(PREFIX + id) ?? '';
    } catch {
      return '';
    }
  },
  save: (id, dataUrl) => {
    try {
      localStorage.setItem(PREFIX + id, dataUrl);
      return true;
    } catch {
      console.warn('[djvj] could not store an image (storage full or unavailable)');
      return false;
    }
  },
  remove: (id) => {
    try {
      localStorage.removeItem(PREFIX + id);
    } catch {
      // nothing to clean up then
    }
  },
};

/** The single logo of earlier versions is gone: images are list entries now. */
export function forgetLegacyLogo(): void {
  try {
    localStorage.removeItem(LEGACY_LOGO_KEY);
  } catch {
    // unavailable storage holds no logo either
  }
}
