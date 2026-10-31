/** Persisted per-browser settings. Storage can be unavailable or corrupted: never trust it. */
export interface Settings {
  deviceId: string;
  /** Master brightness 0..1. */
  intensity: number;
  /** Pixel budget relative to 1080p (1 = 1920x1080 pixels, lower = lighter on the GPU). */
  renderScale: number;
  auto: boolean;
  paletteId: string;
  silenceDb: number;
}

export const DEFAULT_SETTINGS: Settings = {
  deviceId: '',
  intensity: 1,
  renderScale: 1,
  auto: true,
  paletteId: 'synthwave',
  silenceDb: -52,
};

const KEY = 'djvj.settings.v1';

export function sanitizeSettings(raw: unknown): Settings {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const num = (v: unknown, lo: number, hi: number, fallback: number): number =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
  const d = DEFAULT_SETTINGS;
  return {
    deviceId: typeof r.deviceId === 'string' ? r.deviceId : d.deviceId,
    intensity: num(r.intensity, 0, 1, d.intensity),
    renderScale: num(r.renderScale, 0.25, 2, d.renderScale),
    auto: typeof r.auto === 'boolean' ? r.auto : d.auto,
    paletteId: typeof r.paletteId === 'string' ? r.paletteId : d.paletteId,
    silenceDb: num(r.silenceDb, -80, -20, d.silenceDb),
  };
}

export function loadSettings(): Settings {
  try {
    const text = localStorage.getItem(KEY);
    return sanitizeSettings(text ? JSON.parse(text) : null);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable (private window, quota): the show goes on without persistence */
  }
}
