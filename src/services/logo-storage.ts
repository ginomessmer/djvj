const KEY = 'djvj.logo';

export interface LogoStorage {
  load(): string;
  save(dataUrl: string): void;
}

/**
 * The overlay logo, kept in its own storage key: an image is far too big to be rewritten with
 * every settings change or sent with every snapshot. Storage problems just mean no logo.
 */
export const logoStorage: LogoStorage = {
  load: () => {
    try {
      return localStorage.getItem(KEY) ?? '';
    } catch {
      return '';
    }
  },
  save: (dataUrl) => {
    try {
      if (dataUrl) localStorage.setItem(KEY, dataUrl);
      else localStorage.removeItem(KEY);
    } catch {
      console.warn('[djvj] could not store the logo (storage full or unavailable)');
    }
  },
};
