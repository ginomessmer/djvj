import { smoothstep01 } from '../math';

export interface SceneFaderOptions {
  fadeOutSec: number;
  fadeInSec: number;
}

const DEFAULTS: SceneFaderOptions = { fadeOutSec: 0.25, fadeInSec: 0.3 };

/** Dips to black on every scene change so cuts never flash. Starts dark and fades in. */
export class SceneFader<Id> {
  private readonly options: SceneFaderOptions;
  private level = 0;

  constructor(
    private shown: Id,
    options: Partial<SceneFaderOptions> = {},
  ) {
    this.options = { ...DEFAULTS, ...options };
  }

  /** @param instant switch immediately at full brightness (panic) */
  update(wanted: Id, dtSec: number, instant = false): { shownId: Id; brightness: number } {
    if (instant) {
      this.shown = wanted;
      this.level = 1;
    } else if (wanted !== this.shown) {
      this.level -= dtSec / this.options.fadeOutSec;
      if (this.level <= 0) {
        this.level = 0;
        this.shown = wanted;
      }
    } else if (this.level < 1) {
      this.level = Math.min(1, this.level + dtSec / this.options.fadeInSec);
    }
    return { shownId: this.shown, brightness: smoothstep01(this.level) };
  }
}
