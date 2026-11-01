import { clamp01 } from '../math';
import { type AudioFeatures, silentFeatures } from './audio-features';

/**
 * Simulated "music" (4-on-the-floor with off-beat hats and a slow build) for checking the visuals
 * without any audio input. Pure function of time.
 */
export function demoFeatures(tSec: number, bpm = 128): AudioFeatures {
  const beatSec = 60 / bpm;
  const beatPhase = (tSec % beatSec) / beatSec;
  const offBeatPhase = ((tSec + beatSec / 2) % beatSec) / beatSec;
  const kick = Math.exp(-beatPhase * 7);
  const hat = Math.exp(-offBeatPhase * 12);
  const swell = 0.5 + 0.5 * Math.sin((2 * Math.PI * tSec) / (beatSec * 32));

  const bands = [
    kick * 0.85 * (0.6 + 0.4 * swell),
    kick * 0.7 + 0.25 * swell,
    0.25 + 0.3 * swell + 0.15 * Math.sin(tSec * 1.7),
    0.15 + 0.5 * hat * swell,
    0.1 + 0.6 * hat,
  ].map(clamp01);

  return {
    ...silentFeatures(),
    bands,
    energy: 0.35 + 0.5 * swell,
    loudnessDb: -18,
    kick,
    onset: hat,
    signal: true,
  };
}
