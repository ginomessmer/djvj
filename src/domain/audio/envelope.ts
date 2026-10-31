/** One-pole smoother with separate attack (rising) and release (falling) time constants. */
export class Envelope {
  value = 0;

  constructor(
    private readonly attackMs: number,
    private readonly releaseMs: number,
  ) {}

  update(target: number, dtMs: number): number {
    const timeConstantMs = target > this.value ? this.attackMs : this.releaseMs;
    const blend = timeConstantMs <= 0 ? 1 : 1 - Math.exp(-dtMs / timeConstantMs);
    this.value += (target - this.value) * blend;
    return this.value;
  }
}
