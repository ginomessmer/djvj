/**
 * Phase-1 "director": rotates through scenes on a timer while there is music.
 * (The energy-aware, phrase-aligned director replaces this in phase 2.)
 */
export class SceneRotator {
  current: string;
  private nextAt: number | null = null;

  constructor(
    private ids: string[],
    private readonly rng: () => number = Math.random,
    public intervalSec = 45,
    current?: string,
  ) {
    this.current = current ?? ids[0] ?? '';
  }

  setScenes(ids: string[]): void {
    this.ids = ids;
  }

  /** Call when the scene was changed from outside (manual pick) so the timer restarts. */
  setCurrent(id: string): void {
    this.current = id;
    this.nextAt = null;
  }

  /**
   * @param active  true while music is playing and auto mode is on; the timer only runs then,
   *                so scenes do not burn through while the input is silent.
   * @returns the scene to switch to, or null to stay.
   */
  tick(tSec: number, active: boolean): string | null {
    if (!active || this.ids.length < 2) {
      this.nextAt = null;
      return null;
    }
    if (this.nextAt === null) {
      this.nextAt = tSec + this.interval();
      return null;
    }
    if (tSec < this.nextAt) return null;

    const candidates = this.ids.filter((id) => id !== this.current);
    const pick = candidates[Math.min(candidates.length - 1, Math.floor(this.rng() * candidates.length))];
    this.nextAt = tSec + this.interval();
    if (pick === undefined) return null;
    this.current = pick;
    return pick;
  }

  /** ±20 % jitter so it never feels like a metronome. */
  private interval(): number {
    return this.intervalSec * (0.8 + 0.4 * this.rng());
  }
}
