export const BAND_NAMES = ['sub', 'bass', 'mid', 'high-mid', 'high'] as const;
export const BAND_COUNT = BAND_NAMES.length;

/** Band `i` spans `BAND_EDGES_HZ[i]` to `BAND_EDGES_HZ[i + 1]`. */
export const BAND_EDGES_HZ = [20, 60, 250, 2000, 6000, 16000] as const;

/** How much each band contributes to the overall energy (bass-heavy). */
export const BAND_ENERGY_WEIGHTS = [0.25, 0.3, 0.2, 0.15, 0.1] as const;
