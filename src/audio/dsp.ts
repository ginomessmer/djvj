/**
 * Small, dependency-free DSP building blocks. Everything here is pure (no browser APIs)
 * so it can be unit-tested with synthetic signals.
 */

export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

/** One-pole smoother with separate attack (rising) and release (falling) time constants. */
export class Envelope {
  value = 0;

  constructor(
    private readonly attackMs: number,
    private readonly releaseMs: number,
  ) {}

  update(target: number, dtMs: number): number {
    const tau = target > this.value ? this.attackMs : this.releaseMs;
    const k = tau <= 0 ? 1 : 1 - Math.exp(-dtMs / tau);
    this.value += (target - this.value) * k;
    return this.value;
  }

  reset(value = 0): void {
    this.value = value;
  }
}

export interface AdaptiveRangeOptions {
  /** Seconds for the upper bound to relax towards the signal after a loud passage. */
  hiDecaySec?: number;
  /** Seconds for the lower bound to relax upwards after a quiet passage. */
  loRiseSec?: number;
  /** The range never gets narrower than this (dB), so noise is not blown up to full scale. */
  minSpanDb?: number;
  /** The upper bound never drops below this (dB): a band that is truly quiet must read low. */
  minHiDb?: number;
}

/**
 * Auto-gain in the dB domain. Tracks the recent loudest and quietest level of a signal and
 * maps the current value into 0..1 between them. Rises instantly, decays slowly, so the same
 * visuals work for a quiet room microphone and a hot line-in without manual gain staging.
 */
export class AdaptiveRange {
  private lo = 0;
  private hi = 0;
  private primed = false;
  private readonly hiDecaySec: number;
  private readonly loRiseSec: number;
  private readonly minSpanDb: number;
  private readonly minHiDb: number;

  constructor(options: AdaptiveRangeOptions = {}) {
    this.hiDecaySec = options.hiDecaySec ?? 12;
    this.loRiseSec = options.loRiseSec ?? 30;
    this.minSpanDb = options.minSpanDb ?? 14;
    this.minHiDb = options.minHiDb ?? -75;
  }

  normalize(db: number, dtSec: number): number {
    if (!Number.isFinite(db)) return 0;
    if (!this.primed) {
      this.lo = db;
      this.hi = db;
      this.primed = true;
    }

    if (db > this.hi) this.hi = db;
    else this.hi += (db - this.hi) * (1 - Math.exp(-dtSec / this.hiDecaySec));

    if (db < this.lo) this.lo = db;
    else this.lo += (db - this.lo) * (1 - Math.exp(-dtSec / this.loRiseSec));

    if (this.hi < this.minHiDb) this.hi = this.minHiDb;
    if (this.lo > this.hi - this.minSpanDb) this.lo = this.hi - this.minSpanDb;

    return clamp01((db - this.lo) / (this.hi - this.lo));
  }
}

/**
 * Spectral-flux style onset detector on a 0..1 level. Fires when the level jumps up by more
 * than an adaptive threshold, with a refractory period so one drum hit is one event.
 */
export class OnsetDetector {
  private prev = 0;
  private meanFlux = 0;
  private lastHit = -Infinity;

  constructor(
    private readonly sensitivity = 1.6,
    private readonly minFlux = 0.06,
    private readonly refractorySec = 0.12,
    private readonly meanTauSec = 1,
  ) {}

  update(level: number, tSec: number, dtSec: number): boolean {
    const flux = Math.max(0, level - this.prev);
    this.prev = level;

    const threshold = Math.max(this.minFlux, this.meanFlux * this.sensitivity);
    const hit = flux > threshold && tSec - this.lastHit >= this.refractorySec;
    if (hit) this.lastHit = tSec;

    this.meanFlux += (flux - this.meanFlux) * (1 - Math.exp(-dtSec / this.meanTauSec));
    return hit;
  }
}

/**
 * Decides whether there is "music" or just a silent / noisy input. Turns on quickly, turns off
 * slowly (a breakdown or a short gap between tracks must not trigger the idle visuals).
 */
export class SignalGate {
  present = false;
  private above = 0;
  private below = 0;

  constructor(
    private thresholdDb = -52,
    private readonly onDelaySec = 0.4,
    private readonly offDelaySec = 3,
    private readonly hysteresisDb = 3,
  ) {}

  setThreshold(db: number): void {
    this.thresholdDb = db;
  }

  update(levelDb: number, dtSec: number): boolean {
    if (levelDb > this.thresholdDb) {
      this.above += dtSec;
      this.below = 0;
    } else if (levelDb < this.thresholdDb - this.hysteresisDb) {
      this.below += dtSec;
      this.above = 0;
    }

    if (!this.present && this.above >= this.onDelaySec) this.present = true;
    else if (this.present && this.below >= this.offDelaySec) this.present = false;
    return this.present;
  }
}
