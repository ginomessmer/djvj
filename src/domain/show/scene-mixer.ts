import { smoothstep01 } from '../math';

/** Two scenes and how far the screen has moved from the first to the second. */
export interface SceneMix<Id> {
  /** The scene fading out (equal to `toId` once a transition is done). */
  fromId: Id;
  /** The scene fading in. */
  toId: Id;
  /** 0 = only `fromId` visible, 1 = only `toId`. */
  mix: number;
  /** Overall brightness: fades in once at start-up. */
  brightness: number;
}

const STARTUP_FADE_SEC = 0.5;

/** Crossfades to whatever scene is wanted. A duration of 0 is a hard cut. */
export class SceneMixer<Id> {
  private fromId: Id;
  private toId: Id;
  private progress = 1;
  private durationSec = 0;
  private startup = 0;

  constructor(initialId: Id) {
    this.fromId = initialId;
    this.toId = initialId;
  }

  /** @param durationSec how long the crossfade lasts if `wantedId` is new; 0 cuts */
  update(wantedId: Id, dtSec: number, durationSec: number): SceneMix<Id> {
    if (wantedId !== this.toId) this.begin(wantedId, durationSec);
    if (this.progress < 1) {
      this.progress = Math.min(1, this.progress + dtSec / this.durationSec);
      if (this.progress >= 1) this.fromId = this.toId;
    }
    this.startup = Math.min(1, this.startup + dtSec / STARTUP_FADE_SEC);
    return {
      fromId: this.fromId,
      toId: this.toId,
      mix: this.progress >= 1 ? 1 : smoothstep01(this.progress),
      brightness: smoothstep01(this.startup),
    };
  }

  private begin(wantedId: Id, durationSec: number): void {
    // Interrupted half-way: carry on from whichever scene dominates the screen.
    if (this.progress >= 0.5) this.fromId = this.toId;
    this.toId = wantedId;
    this.durationSec = durationSec;
    this.progress = durationSec > 0 ? 0 : 1;
    if (durationSec <= 0) this.fromId = wantedId;
  }
}
