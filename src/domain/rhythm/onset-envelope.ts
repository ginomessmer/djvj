/**
 * Fixed-rate history of a signal that arrives once per video frame, at irregular times. Each new
 * value fills the time since the previous one (zero-order hold), so periodicity analysis can work
 * in real seconds whatever the frame rate.
 */
export class OnsetEnvelope {
  private readonly buffer: Float32Array;
  private writeIndex = 0;
  private filled = 0;
  private nextSampleSec: number | null = null;

  constructor(
    readonly rateHz: number,
    windowSec: number,
  ) {
    this.buffer = new Float32Array(Math.round(rateHz * windowSec));
  }

  /** Seconds of history currently held. */
  get seconds(): number {
    return this.filled / this.rateHz;
  }

  push(tSec: number, value: number): void {
    const step = 1 / this.rateHz;
    const capacitySec = this.buffer.length * step;
    if (this.nextSampleSec === null || tSec - this.nextSampleSec > capacitySec) {
      // First value, or a gap longer than the window (e.g. a hidden tab): the history is stale.
      this.nextSampleSec = tSec;
      this.filled = 0;
    }
    while (this.nextSampleSec <= tSec) {
      this.buffer[this.writeIndex] = value;
      this.writeIndex = (this.writeIndex + 1) % this.buffer.length;
      this.filled = Math.min(this.buffer.length, this.filled + 1);
      this.nextSampleSec += step;
    }
  }

  /** The history, oldest first. */
  samples(): Float32Array {
    const out = new Float32Array(this.filled);
    const start = (this.writeIndex - this.filled + this.buffer.length) % this.buffer.length;
    for (let i = 0; i < this.filled; i++) out[i] = this.buffer[(start + i) % this.buffer.length];
    return out;
  }
}
