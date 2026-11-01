export interface ResolutionGovernorOptions {
  /** Average frame time above this means the GPU is struggling. */
  slowFrameMs: number;
  /** Below this there is room to go back up. */
  fastFrameMs: number;
  downAfterSec: number;
  upAfterSec: number;
  /** Each step multiplies the pixel budget by this (and divides it on the way up). */
  step: number;
  minScale: number;
}

const DEFAULTS: ResolutionGovernorOptions = {
  slowFrameMs: 20,
  fastFrameMs: 17.5,
  downAfterSec: 1,
  upAfterSec: 6,
  step: 0.8,
  minScale: 0.35,
};

/**
 * Lowers the render resolution when frames get slow and raises it again, slowly, when there is
 * headroom. Keeps the GPU from starving everything else on the laptop (rekordbox's audio first).
 */
export class ResolutionGovernor {
  scale = 1;
  private readonly options: ResolutionGovernorOptions;
  private averageMs = 1000 / 60;
  private slowSec = 0;
  private fastSec = 0;

  constructor(options: Partial<ResolutionGovernorOptions> = {}) {
    this.options = { ...DEFAULTS, ...options };
  }

  /** @returns the factor to apply to the pixel budget (1 = as set by the DJ) */
  update(dtSec: number, enabled: boolean): number {
    const { slowFrameMs, fastFrameMs, downAfterSec, upAfterSec, step, minScale } = this.options;
    if (!enabled) {
      this.scale = 1;
      this.slowSec = 0;
      this.fastSec = 0;
      return this.scale;
    }

    this.averageMs += (dtSec * 1000 - this.averageMs) * (1 - Math.exp(-dtSec / 0.5));
    if (this.averageMs > slowFrameMs) {
      this.slowSec += dtSec;
      this.fastSec = 0;
    } else if (this.averageMs < fastFrameMs) {
      this.fastSec += dtSec;
      this.slowSec = 0;
    }

    if (this.slowSec >= downAfterSec && this.scale > minScale) {
      this.scale = Math.max(minScale, this.scale * step);
      this.slowSec = 0;
    } else if (this.fastSec >= upAfterSec && this.scale < 1) {
      this.scale = Math.min(1, this.scale / step);
      this.fastSec = 0;
    }
    return this.scale;
  }
}
