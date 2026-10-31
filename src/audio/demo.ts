import { BAND_COUNT, type AudioFeatures } from './features';

/**
 * Simulated "music" (4-on-the-floor with off-beat hats and a slow build) for checking the
 * visuals without any audio input. Pure function of time.
 */
export function demoFeatures(tSec: number, bpm = 128): AudioFeatures {
  const beat = 60 / bpm;
  const phase = (tSec % beat) / beat;
  const offPhase = ((tSec + beat / 2) % beat) / beat;
  const kick = Math.exp(-phase * 7);
  const hat = Math.exp(-offPhase * 12);
  const swell = 0.5 + 0.5 * Math.sin((2 * Math.PI * tSec) / (beat * 32));
  const energy = 0.35 + 0.5 * swell;

  const bands = new Array<number>(BAND_COUNT).fill(0);
  bands[0] = kick * 0.85 * (0.6 + 0.4 * swell);
  bands[1] = Math.min(1, kick * 0.7 + 0.25 * swell);
  bands[2] = 0.25 + 0.3 * swell + 0.15 * Math.sin(tSec * 1.7);
  bands[3] = 0.15 + 0.5 * hat * swell;
  bands[4] = 0.1 + 0.6 * hat;

  return {
    bands: bands.map((v) => Math.min(1, Math.max(0, v))),
    energy,
    loudnessDb: -18,
    kick,
    onset: hat,
    kickHit: false,
    onsetHit: false,
    signal: true,
  };
}
