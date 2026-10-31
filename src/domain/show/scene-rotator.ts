export interface SceneRotatorOptions {
  intervalSec: number;
  rng: () => number;
}

const DEFAULTS: SceneRotatorOptions = { intervalSec: 45, rng: Math.random };

/** Picks a different scene every ~`intervalSec` seconds, but only while it is `active`. */
export class SceneRotator<Id extends string> {
  private readonly options: SceneRotatorOptions;
  private nextChangeAtSec: number | null = null;

  constructor(
    private readonly ids: readonly Id[],
    private current: Id,
    options: Partial<SceneRotatorOptions> = {},
  ) {
    this.options = { ...DEFAULTS, ...options };
  }

  /** Call when the scene was changed from outside (manual pick) so the timer restarts. */
  sync(id: Id): void {
    if (id === this.current) return;
    this.current = id;
    this.nextChangeAtSec = null;
  }

  /**
   * @param active true while music plays and auto mode is on. The timer only runs then, so
   *   scenes do not burn through during silence, and re-enabling it waits a full interval.
   * @returns the scene to switch to, or null to stay.
   */
  tick(tSec: number, active: boolean): Id | null {
    if (!active || this.ids.length < 2) {
      this.nextChangeAtSec = null;
      return null;
    }
    if (this.nextChangeAtSec === null) {
      this.nextChangeAtSec = tSec + this.interval();
      return null;
    }
    if (tSec < this.nextChangeAtSec) return null;

    const candidates = this.ids.filter((id) => id !== this.current);
    const next = candidates[Math.floor(this.options.rng() * candidates.length) % candidates.length];
    this.nextChangeAtSec = tSec + this.interval();
    this.current = next;
    return next;
  }

  /** ±20 % jitter so it never feels like a metronome. */
  private interval(): number {
    return this.options.intervalSec * (0.8 + 0.4 * this.options.rng());
  }
}
