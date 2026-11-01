import { type AudioFeatures, silentFeatures } from '../audio/audio-features';
import { fract } from '../math';

export interface Frame {
  tSec: number;
  features: AudioFeatures;
}

export interface KickTrainOptions {
  bpm: number;
  seconds: number;
  startSec?: number;
  /** Time of a kick (the grid is aligned to it). Defaults to `startSec`. */
  firstKickSec?: number;
  kickStrength?: number;
  /** Low-end flux of an off-beat bass note half a beat after each kick (0 = none). */
  offBeatStrength?: number;
  /** Punch (loudness jump) of the kick and of the off-beat note. */
  kickPunch?: number;
  offBeatPunch?: number;
  /** Irregular frame times between ~51 and ~69 fps, like a busy browser. */
  jitter?: boolean;
}

/** Deterministic pseudo-random number in [0, 1). */
export const pseudoRandom = (i: number): number =>
  fract(Math.sin(i * 12.9898 + 4.1414) * 43758.5453);

/** Frames of a 4-on-the-floor low end, as the feature extractor would report them. */
export function kickTrain(options: KickTrainOptions): Frame[] {
  const { bpm, seconds, kickStrength = 1, offBeatStrength = 0, jitter = false } = options;
  const { kickPunch = 0.7, offBeatPunch = 0.4 } = options;
  const startSec = options.startSec ?? 0;
  const firstKickSec = options.firstKickSec ?? startSec;
  const beatSec = 60 / bpm;
  const beatIndex = (t: number) => Math.floor((t - firstKickSec) / beatSec);
  const offBeatIndex = (t: number) => Math.floor((t - firstKickSec - beatSec / 2) / beatSec);

  const frames: Frame[] = [];
  let t = startSec;
  for (let i = 0; t < startSec + seconds; i++) {
    const previous = t;
    t += (1 / 60) * (jitter ? 0.85 + 0.3 * pseudoRandom(i) : 1);
    const kick = t >= firstKickSec && beatIndex(t) > beatIndex(previous);
    const offBeat = offBeatStrength > 0 && offBeatIndex(t) > offBeatIndex(previous);
    const strength = kick ? kickStrength : offBeat ? offBeatStrength : 0;
    const punch = kick ? kickPunch : offBeat ? offBeatPunch : 0;
    frames.push({ tSec: t, features: lowEnd(strength, punch) });
  }
  return frames;
}

/** Frames with music but no low-end onsets (or no signal at all). */
export function silence(seconds: number, startSec: number, signal = false): Frame[] {
  const frames: Frame[] = [];
  for (let t = startSec + 1 / 60; t < startSec + seconds; t += 1 / 60) {
    frames.push({ tSec: t, features: { ...silentFeatures(), signal } });
  }
  return frames;
}

/** Onsets at random times, about two per second: no tempo in it. */
export function randomOnsets(seconds: number): Frame[] {
  const frames: Frame[] = [];
  for (let i = 0; i * (1 / 60) < seconds; i++) {
    const strength = pseudoRandom(i) < 2 / 60 ? 0.5 + 0.5 * pseudoRandom(i + 1000) : 0;
    frames.push({ tSec: (i + 1) / 60, features: lowEnd(strength, strength) });
  }
  return frames;
}

function lowEnd(strength: number, punch: number): AudioFeatures {
  return { ...silentFeatures(), signal: true, lowEndFlux: strength, punch, kickHit: strength > 0 };
}
