import { AdaptiveRange, Envelope, OnsetDetector, SignalGate } from './dsp';

export const BAND_COUNT = 5;
/** sub, bass, mid, high-mid, high */
export const BAND_EDGES_HZ: readonly number[] = [20, 60, 250, 2000, 6000, 16000];
export const BAND_NAMES: readonly string[] = ['sub', 'bass', 'mid', 'high-mid', 'high'];
const ENERGY_WEIGHTS: readonly number[] = [0.25, 0.3, 0.2, 0.15, 0.1];

/** What the visuals get to see each frame. Everything is normalised to 0..1. */
export interface AudioFeatures {
  /** Smoothed per-band level, see BAND_NAMES. */
  bands: number[];
  /** Overall musical energy (bass-weighted, slow). Good for speed / intensity. */
  energy: number;
  /** Input loudness in dBFS (RMS). Diagnostic. */
  loudnessDb: number;
  /**
   * Envelope that jumps to 1 on every low-frequency onset and decays in ~150 ms.
   * This is a *low-end onset*, not a true kick detector: punchy off-beat bass notes trigger it
   * too (measured: a 128 BPM kick + off-beat bass stab fires twice per beat). Fine for visual
   * pulses; the phase-2 beat tracker must not treat it as the beat.
   */
  kick: number;
  /** Same for broadband (hat / snare / percussion) onsets. */
  onset: number;
  /** True only on the single frame where a low-end onset was detected. */
  kickHit: boolean;
  /** True only on the single frame where a percussive onset was detected. */
  onsetHit: boolean;
  /** False while the input is silent. Visuals fall back to idle mode. */
  signal: boolean;
}

export interface ExtractorOptions {
  sampleRate: number;
  /** AnalyserNode.frequencyBinCount (fftSize / 2). */
  binCount: number;
  silenceDb?: number;
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

/**
 * Turns one FFT frame (dB per bin, as from AnalyserNode.getFloatFrequencyData) plus the
 * time-domain RMS into the compact feature set above.
 */
export class FeatureExtractor {
  readonly gate: SignalGate;
  private readonly binRanges: Array<[number, number]>;
  private readonly ranges = Array.from({ length: BAND_COUNT }, () => new AdaptiveRange());
  private readonly bandEnv = [
    new Envelope(15, 220),
    new Envelope(10, 160),
    new Envelope(20, 200),
    new Envelope(15, 140),
    new Envelope(10, 120),
  ];
  private readonly energyEnv = new Envelope(80, 450);
  private readonly kickEnv = new Envelope(0, 160);
  private readonly onsetEnv = new Envelope(0, 120);
  private readonly kickDetector = new OnsetDetector(1.6, 0.06, 0.12);
  private readonly onsetDetector = new OnsetDetector(1.8, 0.08, 0.09);
  private lastT: number | null = null;

  constructor(options: ExtractorOptions) {
    this.gate = new SignalGate(options.silenceDb ?? -52);
    const binHz = options.sampleRate / (options.binCount * 2);
    this.binRanges = Array.from({ length: BAND_COUNT }, (_, i) => {
      const lo = Math.max(1, Math.round((BAND_EDGES_HZ[i] ?? 20) / binHz));
      const hi = Math.min(options.binCount - 1, Math.max(lo, Math.round((BAND_EDGES_HZ[i + 1] ?? 16000) / binHz)));
      return [lo, hi] as [number, number];
    });
  }

  process(freqDb: ArrayLike<number>, rms: number, tSec: number): AudioFeatures {
    const dt = this.lastT === null ? 1 / 60 : Math.min(0.25, Math.max(0.001, tSec - this.lastT));
    this.lastT = tSec;
    const dtMs = dt * 1000;

    const loudnessDb = 20 * Math.log10(rms + 1e-9);
    const signal = this.gate.update(loudnessDb, dt);

    const raw = new Array<number>(BAND_COUNT).fill(0);
    if (signal) {
      for (let i = 0; i < BAND_COUNT; i++) {
        const [a, b] = this.binRanges[i] as [number, number];
        let power = 0;
        for (let k = a; k <= b; k++) {
          const db = freqDb[k] ?? -120;
          if (Number.isFinite(db)) power += Math.pow(10, db / 10);
        }
        const bandDb = 10 * Math.log10(power / (b - a + 1) + 1e-12);
        raw[i] = (this.ranges[i] as AdaptiveRange).normalize(bandDb, dt);
      }
    }

    const bands = raw.map((v, i) => (this.bandEnv[i] as Envelope).update(v, dtMs));
    const energy = this.energyEnv.update(
      raw.reduce((sum, v, i) => sum + v * (ENERGY_WEIGHTS[i] ?? 0), 0),
      dtMs,
    );

    const low = Math.max(raw[0] ?? 0, raw[1] ?? 0);
    const perc = ((raw[2] ?? 0) + (raw[3] ?? 0) + (raw[4] ?? 0)) / 3;
    const kickHit = signal && this.kickDetector.update(low, tSec, dt);
    const onsetHit = signal && this.onsetDetector.update(perc, tSec, dt);

    return {
      bands,
      energy,
      loudnessDb,
      kick: this.kickEnv.update(kickHit ? 1 : 0, dtMs),
      onset: this.onsetEnv.update(onsetHit ? 1 : 0, dtMs),
      kickHit,
      onsetHit,
      signal,
    };
  }
}
