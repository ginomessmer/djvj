import { BAND_COUNT } from './bands';

/** What the visuals get to see each frame. Everything is normalised to 0..1. */
export interface AudioFeatures {
  /** Smoothed per-band level, see `BAND_NAMES`. */
  bands: number[];
  /** Overall musical energy (bass-weighted, slow). Good for speed and intensity. */
  energy: number;
  /** Input loudness in dBFS (RMS). Diagnostic. */
  loudnessDb: number;
  /**
   * Envelope that jumps to 1 on every low-frequency onset and decays in ~150 ms.
   * This is a low-end onset, not a true kick detector: punchy off-beat bass notes trigger it
   * too (measured: a 128 BPM kick plus an off-beat bass stab fires twice per beat). Fine for
   * visual pulses; a beat tracker must not treat it as the beat.
   */
  kick: number;
  /** Same for broadband (hat, snare, percussion) onsets. */
  onset: number;
  /** True only on the single frame where a low-end onset was detected. */
  kickHit: boolean;
  /** True only on the single frame where a percussive onset was detected. */
  onsetHit: boolean;
  /** False while the input is silent. Visuals fall back to idle mode. */
  signal: boolean;
}

export function silentFeatures(): AudioFeatures {
  return {
    bands: new Array<number>(BAND_COUNT).fill(0),
    energy: 0,
    loudnessDb: -120,
    kick: 0,
    onset: 0,
    kickHit: false,
    onsetHit: false,
    signal: false,
  };
}
