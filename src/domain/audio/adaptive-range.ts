import { clamp01 } from '../math';

export interface AdaptiveRangeOptions {
  /** Seconds for the upper bound to relax towards the signal after a loud passage. */
  hiDecaySec: number;
  /** Seconds for the lower bound to relax upwards after a quiet passage. */
  loRiseSec: number;
  /** The range never gets narrower than this (dB), so noise is not blown up to full scale. */
  minSpanDb: number;
  /** The upper bound never drops below this (dB): a truly quiet band must read low. */
  minHiDb: number;
}

const DEFAULTS: AdaptiveRangeOptions = {
  hiDecaySec: 12,
  loRiseSec: 30,
  minSpanDb: 14,
  minHiDb: -75,
};

/**
 * Auto-gain in the dB domain. Tracks the recent loudest and quietest level of a signal and maps
 * the current value into 0..1 between them. Rises instantly, decays slowly, so the same visuals
 * work for a quiet room microphone and a hot line-in without manual gain staging.
 */
export class AdaptiveRange {
  private readonly options: AdaptiveRangeOptions;
  private lo = 0;
  private hi = 0;
  private primed = false;

  constructor(options: Partial<AdaptiveRangeOptions> = {}) {
    this.options = { ...DEFAULTS, ...options };
  }

  normalize(db: number, dtSec: number): number {
    if (!Number.isFinite(db)) return 0;
    const { hiDecaySec, loRiseSec, minSpanDb, minHiDb } = this.options;

    if (!this.primed) {
      this.lo = db;
      this.hi = db;
      this.primed = true;
    }

    if (db > this.hi) this.hi = db;
    else this.hi += (db - this.hi) * (1 - Math.exp(-dtSec / hiDecaySec));

    if (db < this.lo) this.lo = db;
    else this.lo += (db - this.lo) * (1 - Math.exp(-dtSec / loRiseSec));

    this.hi = Math.max(this.hi, minHiDb);
    this.lo = Math.min(this.lo, this.hi - minSpanDb);

    return clamp01((db - this.lo) / (this.hi - this.lo));
  }
}
