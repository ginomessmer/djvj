export interface OnsetDetectorOptions {
  /** A jump must exceed the running mean jump times this to count. */
  sensitivity: number;
  /** Absolute minimum jump (0..1) so tiny wobbles never count. */
  minFlux: number;
  /** One drum hit is one event: ignore further hits for this long. */
  refractorySec: number;
  /** Time constant of the running mean. */
  meanTauSec: number;
}

const DEFAULTS: OnsetDetectorOptions = {
  sensitivity: 1.6,
  minFlux: 0.06,
  refractorySec: 0.12,
  meanTauSec: 1,
};

/**
 * Spectral-flux style onset detector on a 0..1 level. Fires when the level jumps up by more than
 * an adaptive threshold.
 */
export class OnsetDetector {
  private readonly options: OnsetDetectorOptions;
  private previousLevel = 0;
  private meanFlux = 0;
  private lastHitSec = Number.NEGATIVE_INFINITY;

  constructor(options: Partial<OnsetDetectorOptions> = {}) {
    this.options = { ...DEFAULTS, ...options };
  }

  update(level: number, tSec: number, dtSec: number): boolean {
    const { sensitivity, minFlux, refractorySec, meanTauSec } = this.options;
    const flux = Math.max(0, level - this.previousLevel);
    this.previousLevel = level;

    const threshold = Math.max(minFlux, this.meanFlux * sensitivity);
    const hit = flux > threshold && tSec - this.lastHitSec >= refractorySec;
    if (hit) this.lastHitSec = tSec;

    this.meanFlux += (flux - this.meanFlux) * (1 - Math.exp(-dtSec / meanTauSec));
    return hit;
  }
}
