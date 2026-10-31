import { clamp01 } from '../math';
import { type AudioFeatures, silentFeatures } from './audio-features';

const BARS_PER_CYCLE = 32;
/** The last bars of each cycle are a breakdown that builds up; the cycle restarts with a drop. */
const BREAKDOWN_FROM_BAR = 24;
const FRAME_SEC = 1 / 60;

/**
 * Simulated music for checking the visuals without any audio input: a 4-on-the-floor groove with
 * off-beat hats, then a breakdown whose highs rise into the next drop. Pure function of time.
 */
export function demoFeatures(tSec: number, bpm = 128): AudioFeatures {
  const beatSec = 60 / bpm;
  const bar = (tSec / (beatSec * 4)) % BARS_PER_CYCLE;
  const breakdown = bar >= BREAKDOWN_FROM_BAR;
  const build = breakdown ? (bar - BREAKDOWN_FROM_BAR) / (BARS_PER_CYCLE - BREAKDOWN_FROM_BAR) : 0;

  const kick = kickAt(tSec, beatSec);
  const lowEndFlux = Math.max(0, kick - kickAt(tSec - FRAME_SEC, beatSec));
  const offBeatPhase = ((tSec + beatSec / 2) % beatSec) / beatSec;
  const hat = Math.exp(-offBeatPhase * 12);
  const swell = 0.5 + 0.5 * Math.sin((2 * Math.PI * tSec) / (beatSec * 32));

  const bands = breakdown
    ? [0.05, 0.08, 0.5 + 0.1 * Math.sin(tSec * 1.3), 0.2 + 0.7 * build * hat, 0.2 + 0.7 * build]
    : [
        kick * 0.85 * (0.6 + 0.4 * swell),
        kick * 0.7 + 0.25 * swell,
        0.25 + 0.3 * swell + 0.15 * Math.sin(tSec * 1.7),
        0.15 + 0.5 * hat * swell,
        0.1 + 0.6 * hat,
      ];

  return {
    ...silentFeatures(),
    bands: bands.map(clamp01),
    bandsDb: breakdown
      ? [-68, -65, -32, -50 + 18 * build, -50 + 18 * build]
      : [-22, -20, -30, -40, -42],
    energy: breakdown ? 0.25 + 0.4 * build : 0.35 + 0.5 * swell,
    loudnessDb: breakdown ? -24 + 6 * build : -14,
    kick,
    lowEndDb: breakdown ? -68 : -20,
    kickHit: lowEndFlux > 0.5,
    lowEndFlux,
    punch: lowEndFlux > 0.5 ? 0.7 : 0,
    onset: hat,
    signal: true,
  };
}

/** Kick envelope: jumps to 1 on every beat of the groove, silent in the breakdown. */
function kickAt(tSec: number, beatSec: number): number {
  const bar = (tSec / (beatSec * 4)) % BARS_PER_CYCLE;
  if (tSec < 0 || bar >= BREAKDOWN_FROM_BAR) return 0;
  return Math.exp(-((tSec % beatSec) / beatSec) * 7);
}
