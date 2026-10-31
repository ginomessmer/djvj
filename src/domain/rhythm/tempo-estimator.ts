import { clamp, clamp01 } from '../math';
import { OnsetEnvelope } from './onset-envelope';

export interface TempoEstimate {
  /** 0 until enough music has been heard. */
  bpm: number;
  /** 0..1: how periodic the low end is at that tempo. */
  confidence: number;
}

export interface TempoEstimatorOptions {
  minBpm: number;
  maxBpm: number;
  windowSec: number;
  /** No estimate before this much music. */
  minHistorySec: number;
  updateIntervalSec: number;
  /** The reported tempo is the median of this many recent estimates. */
  medianOf: number;
}

const DEFAULTS: TempoEstimatorOptions = {
  // Techno, electronic and trance. The narrow range also rules out reading a kick plus an off-beat
  // bass as double tempo (~256 BPM).
  minBpm: 115,
  maxBpm: 160,
  windowSec: 8,
  minHistorySec: 4,
  updateIntervalSec: 0.5,
  medianOf: 5,
};

const RATE_HZ = 100;
/** Below this normalised autocorrelation the low end is not periodic: keep the last tempo. */
const MIN_PERIODICITY = 0.3;
const CONFIDENCE_DECAY = 0.6;

function autocorrelation(x: Float32Array, lag: number): number {
  let sum = 0;
  for (let i = 0; i + lag < x.length; i++) sum += x[i] * x[i + lag];
  return sum;
}

/** Sub-sample position of a peak from its two neighbours. */
function parabolicOffset(left: number, centre: number, right: number): number {
  const curvature = left - 2 * centre + right;
  return curvature === 0 ? 0 : clamp((0.5 * (left - right)) / curvature, -0.5, 0.5);
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Finds the tempo from the autocorrelation of the low-end onset strength: the beat period is the
 * lag at which the signal best matches itself (reinforced by twice that lag). Robust but coarse
 * (about ±1 BPM, onsets come at frame rate); the beat clock refines it.
 */
export class TempoEstimator {
  private readonly options: TempoEstimatorOptions;
  private readonly envelope: OnsetEnvelope;
  private readonly recentBpm: number[] = [];
  private nextUpdateSec: number | null = null;
  private estimate: TempoEstimate = { bpm: 0, confidence: 0 };

  constructor(options: Partial<TempoEstimatorOptions> = {}) {
    this.options = { ...DEFAULTS, ...options };
    this.envelope = new OnsetEnvelope(RATE_HZ, this.options.windowSec);
  }

  /** @param onsetStrength low-end onset strength this frame (0 when nothing happened) */
  update(tSec: number, onsetStrength: number): TempoEstimate {
    this.envelope.push(tSec, onsetStrength);
    if (this.nextUpdateSec === null || tSec >= this.nextUpdateSec) {
      this.nextUpdateSec = tSec + this.options.updateIntervalSec;
      this.reestimate();
    }
    return this.estimate;
  }

  private reestimate(): void {
    if (this.envelope.seconds < this.options.minHistorySec) return;

    const x = this.envelope.samples();
    const mean = x.reduce((sum, value) => sum + value, 0) / x.length;
    for (let i = 0; i < x.length; i++) x[i] -= mean;
    const energy = autocorrelation(x, 0);

    const minLag = Math.floor((60 * RATE_HZ) / this.options.maxBpm);
    const maxLag = Math.ceil((60 * RATE_HZ) / this.options.minBpm);
    const score = (lag: number) =>
      (autocorrelation(x, lag) + 0.5 * autocorrelation(x, 2 * lag)) / Math.max(energy, 1e-9);

    let bestLag = minLag;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (let lag = minLag; lag <= maxLag; lag++) {
      const s = score(lag);
      if (s > bestScore) {
        bestScore = s;
        bestLag = lag;
      }
    }
    const periodicity = energy > 1e-6 ? autocorrelation(x, bestLag) / energy : 0;

    if (periodicity < MIN_PERIODICITY) {
      // Breakdown or silence: keep the tempo, lose confidence.
      this.estimate = { ...this.estimate, confidence: this.estimate.confidence * CONFIDENCE_DECAY };
      return;
    }

    const lag = bestLag + parabolicOffset(score(bestLag - 1), bestScore, score(bestLag + 1));
    this.recentBpm.push((60 * RATE_HZ) / lag);
    if (this.recentBpm.length > this.options.medianOf) this.recentBpm.shift();
    this.estimate = {
      bpm: median(this.recentBpm),
      confidence: clamp01((periodicity - 0.15) / 0.45),
    };
  }
}
