export interface FlashGuardOptions {
  /** A change in relative luminance at least this big counts (WCAG: 10 %). */
  minChange: number;
  /** Changes allowed within any second (a flash is two opposing changes; WCAG allows 3 flashes). */
  maxChangesPerSec: number;
  /** How long the guard stays fully on after the last trigger, then it releases over the same time. */
  releaseSec: number;
}

const DEFAULTS: FlashGuardOptions = { minChange: 0.1, maxChangesPerSec: 6, releaseSec: 3 };

/**
 * Watches the measured brightness of the output for flashing (WCAG 2.3.1 "general flash": at most
 * three pairs of opposing 10 % luminance changes per second). When it sees it, `calm` goes to 1 and
 * the runtime damps whatever pulses the image. Brightness is tracked as a zig-zag: a change counts
 * when the luminance turns around by at least `minChange` from its last extreme.
 */
export class FlashGuard {
  private readonly options: FlashGuardOptions;
  private extreme: number | null = null;
  private direction: -1 | 0 | 1 = 0;
  private readonly changeTimes: number[] = [];
  private lastTriggerSec = Number.NEGATIVE_INFINITY;

  constructor(options: Partial<FlashGuardOptions> = {}) {
    this.options = { ...DEFAULTS, ...options };
  }

  /** Feed a measurement: mean relative luminance (0..1) of the screen at `tSec`. */
  observe(tSec: number, luminance: number): void {
    const { minChange, maxChangesPerSec } = this.options;
    if (this.extreme === null) {
      this.extreme = luminance;
      return;
    }
    const rise = luminance - this.extreme;
    if (this.direction >= 0 && rise > 0) this.extreme = luminance;
    else if (this.direction <= 0 && rise < 0) this.extreme = luminance;

    if (this.direction <= 0 && rise >= minChange) this.turn(1, tSec, luminance);
    else if (this.direction >= 0 && -rise >= minChange) this.turn(-1, tSec, luminance);

    while (this.changeTimes.length > 0 && tSec - this.changeTimes[0] > 1) this.changeTimes.shift();
    if (this.changeTimes.length > maxChangesPerSec) this.lastTriggerSec = tSec;
  }

  /** 0 = nothing to do, 1 = flashing detected: damp pulses now. */
  calm(tSec: number): number {
    const { releaseSec } = this.options;
    const since = tSec - this.lastTriggerSec;
    if (since <= releaseSec) return 1;
    return Math.max(0, 1 - (since - releaseSec) / releaseSec);
  }

  private turn(direction: -1 | 1, tSec: number, luminance: number): void {
    this.direction = direction;
    this.extreme = luminance;
    this.changeTimes.push(tSec);
  }
}
