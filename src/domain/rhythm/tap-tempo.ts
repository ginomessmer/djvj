export interface TappedBeat {
  periodSec: number;
  /** Time of a beat (the fitted position of the last tap). */
  beatSec: number;
}

export interface TapTempoOptions {
  /** A pause longer than this starts a new series of taps. */
  resetAfterSec: number;
  minTaps: number;
  maxTaps: number;
  minBpm: number;
  maxBpm: number;
}

const DEFAULTS: TapTempoOptions = {
  resetAfterSec: 2,
  minTaps: 4,
  maxTaps: 8,
  minBpm: 60,
  maxBpm: 200,
};

/** Tempo and phase from taps on the beat: a least-squares fit, so one sloppy tap does not matter. */
export class TapTempo {
  private readonly options: TapTempoOptions;
  private taps: number[] = [];

  constructor(options: Partial<TapTempoOptions> = {}) {
    this.options = { ...DEFAULTS, ...options };
  }

  /** @returns the tapped beat once there are enough taps, else null */
  tap(tSec: number): TappedBeat | null {
    const { resetAfterSec, minTaps, maxTaps, minBpm, maxBpm } = this.options;
    const last = this.taps.at(-1);
    if (last !== undefined && tSec - last > resetAfterSec) this.taps = [];
    this.taps = [...this.taps, tSec].slice(-maxTaps);
    if (this.taps.length < minTaps) return null;

    const n = this.taps.length;
    const meanIndex = (n - 1) / 2;
    const meanSec = this.taps.reduce((sum, t) => sum + t, 0) / n;
    let covariance = 0;
    let variance = 0;
    this.taps.forEach((t, i) => {
      covariance += (i - meanIndex) * (t - meanSec);
      variance += (i - meanIndex) ** 2;
    });
    const periodSec = covariance / variance;
    const bpm = 60 / periodSec;
    if (bpm < minBpm || bpm > maxBpm) return null;
    return { periodSec, beatSec: meanSec + (n - 1 - meanIndex) * periodSec };
  }
}
