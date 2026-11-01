import type { ChangeReason } from './director';

/** When auto mode moves to a new palette: on every drop, and every few phrases in between. */
export class PaletteRotation {
  private phrasesSinceChange = 0;

  constructor(private readonly everyPhrases = 3) {}

  /** @returns whether this scene change should also bring a new palette */
  onSceneChange(reason: ChangeReason): boolean {
    if (reason === 'drop') {
      this.phrasesSinceChange = 0;
      return true;
    }
    if (reason !== 'phrase') return false;
    this.phrasesSinceChange++;
    if (this.phrasesSinceChange < this.everyPhrases) return false;
    this.phrasesSinceChange = 0;
    return true;
  }
}
