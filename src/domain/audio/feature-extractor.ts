import { clamp01 } from '../math';
import { AdaptiveRange } from './adaptive-range';
import type { AudioFeatures } from './audio-features';
import { BAND_COUNT, BAND_EDGES_HZ, BAND_ENERGY_WEIGHTS } from './bands';
import { Envelope } from './envelope';
import { OnsetDetector } from './onset-detector';
import { SignalGate } from './signal-gate';

/** [attack ms, release ms] per band: the lows breathe slower than the highs. */
const BAND_SMOOTHING_MS = [
  [15, 220],
  [10, 160],
  [20, 200],
  [15, 140],
  [10, 120],
] as const;

/** The kick band: kick and bassline, not pads (see `AudioFeatures.lowEndDb`). */
const KICK_BAND_HZ = { from: 40, to: 100 };

const LOW_END_ONSET = { sensitivity: 1.6, minFlux: 0.06, refractorySec: 0.12 };
const PERCUSSION_ONSET = { sensitivity: 1.8, minFlux: 0.08, refractorySec: 0.09 };

/** `punch` compares the loudness with the quieter of the last two frames (an RMS window spans ~2). */
const PUNCH_FULL_SCALE_DB = 20;

const FALLBACK_FRAME_SEC = 1 / 60;
const MAX_FRAME_SEC = 0.25;

export interface FeatureExtractorOptions {
  sampleRate: number;
  /** `AnalyserNode.frequencyBinCount` (fftSize / 2). */
  binCount: number;
  silenceDb: number;
}

interface BinRange {
  from: number;
  to: number;
}

interface BandChannel {
  bins: BinRange;
  range: AdaptiveRange;
  envelope: Envelope;
}

/** Mean power of the bins in `bins`, in dB. */
function bandPowerDb(spectrumDb: ArrayLike<number>, { from, to }: BinRange): number {
  let power = 0;
  for (let bin = from; bin <= to; bin++) {
    const db = spectrumDb[bin] ?? Number.NEGATIVE_INFINITY;
    if (Number.isFinite(db)) power += 10 ** (db / 10);
  }
  return 10 * Math.log10(power / (to - from + 1) + 1e-12);
}

/**
 * Turns one FFT frame (dB per bin, as from `AnalyserNode.getFloatFrequencyData`) plus the
 * time-domain RMS into the compact `AudioFeatures` the visuals use.
 */
export class FeatureExtractor {
  readonly gate: SignalGate;
  private readonly channels: BandChannel[];
  private readonly kickBins: BinRange;
  private readonly kickRange = new AdaptiveRange();
  private readonly energyEnvelope = new Envelope(80, 450);
  private readonly kickEnvelope = new Envelope(0, 160);
  private readonly onsetEnvelope = new Envelope(0, 120);
  private readonly lowEndDetector = new OnsetDetector(LOW_END_ONSET);
  private readonly percussionDetector = new OnsetDetector(PERCUSSION_ONSET);
  private previousLowEnd = 0;
  private recentLoudnessDb: [number, number] = [-120, -120];
  private lastTSec: number | null = null;

  constructor({ sampleRate, binCount, silenceDb }: FeatureExtractorOptions) {
    this.gate = new SignalGate({ thresholdDb: silenceDb });
    const binHz = sampleRate / (binCount * 2);
    const kickFrom = Math.max(1, Math.round(KICK_BAND_HZ.from / binHz));
    this.kickBins = { from: kickFrom, to: Math.max(kickFrom, Math.round(KICK_BAND_HZ.to / binHz)) };
    this.channels = Array.from({ length: BAND_COUNT }, (_, band) => {
      const from = Math.max(1, Math.round(BAND_EDGES_HZ[band] / binHz));
      const to = Math.min(
        binCount - 1,
        Math.max(from, Math.round(BAND_EDGES_HZ[band + 1] / binHz)),
      );
      const [attackMs, releaseMs] = BAND_SMOOTHING_MS[band];
      return {
        bins: { from, to },
        range: new AdaptiveRange(),
        envelope: new Envelope(attackMs, releaseMs),
      };
    });
  }

  process(spectrumDb: ArrayLike<number>, rms: number, tSec: number): AudioFeatures {
    const dtSec = this.elapsedSeconds(tSec);
    const dtMs = dtSec * 1000;

    const loudnessDb = 20 * Math.log10(rms + 1e-9);
    const signal = this.gate.update(loudnessDb, dtSec);

    const bandsDb = this.channels.map(({ bins }) => bandPowerDb(spectrumDb, bins));
    const levels = this.channels.map(({ range }, band) =>
      signal ? range.normalize(bandsDb[band], dtSec) : 0,
    );
    const bands = this.channels.map(({ envelope }, band) => envelope.update(levels[band], dtMs));
    const energy = this.energyEnvelope.update(
      levels.reduce((sum, level, band) => sum + level * BAND_ENERGY_WEIGHTS[band], 0),
      dtMs,
    );

    const lowEndDb = bandPowerDb(spectrumDb, this.kickBins);
    const lowEnd = signal ? this.kickRange.normalize(lowEndDb, dtSec) : 0;
    const lowEndFlux = Math.max(0, lowEnd - this.previousLowEnd);
    this.previousLowEnd = lowEnd;
    const punch = clamp01((loudnessDb - Math.min(...this.recentLoudnessDb)) / PUNCH_FULL_SCALE_DB);
    this.recentLoudnessDb = [this.recentLoudnessDb[1], loudnessDb];
    const percussion = (levels[2] + levels[3] + levels[4]) / 3;
    const kickHit = signal && this.lowEndDetector.update(lowEnd, tSec, dtSec);
    const onsetHit = signal && this.percussionDetector.update(percussion, tSec, dtSec);

    return {
      bands,
      bandsDb,
      energy,
      loudnessDb,
      kick: this.kickEnvelope.update(kickHit ? 1 : 0, dtMs),
      onset: this.onsetEnvelope.update(onsetHit ? 1 : 0, dtMs),
      kickHit,
      lowEndDb,
      lowEndFlux,
      punch,
      onsetHit,
      signal,
    };
  }

  private elapsedSeconds(tSec: number): number {
    const elapsed = this.lastTSec === null ? FALLBACK_FRAME_SEC : tSec - this.lastTSec;
    this.lastTSec = tSec;
    return Math.min(MAX_FRAME_SEC, Math.max(0.001, elapsed));
  }
}
