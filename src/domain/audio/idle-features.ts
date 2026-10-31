import { type AudioFeatures, silentFeatures } from './audio-features';

const BASE_LEVELS = [0.18, 0.24, 0.2, 0.14, 0.1];

/** Gentle "breathing" features for when the input is silent, so the screen never goes dead. */
export function idleFeatures(tSec: number): AudioFeatures {
  return {
    ...silentFeatures(),
    bands: BASE_LEVELS.map(
      (level, band) => level + 0.08 * Math.sin(tSec * (0.3 + band * 0.11) + band),
    ),
    energy: 0.18 + 0.1 * (0.5 + 0.5 * Math.sin(tSec * 0.35)),
  };
}
