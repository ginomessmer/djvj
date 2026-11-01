import { describe, expect, it } from 'vitest';
import { type Section, type SectionInput, SectionTracker } from './section-tracker';

const STEP = 1 / 60;
const BEAT_SEC = 60 / 128;

const GROOVE: SectionInput = {
  signal: true,
  lowDb: -20,
  highDb: -40,
  loudnessDb: -14,
  beatHit: false,
};
const NO_BASS: SectionInput = {
  signal: true,
  lowDb: -65,
  highDb: -48,
  loudnessDb: -24,
  beatHit: false,
};
const SILENT: SectionInput = { ...NO_BASS, signal: false };

/** Feeds one input (or a function of the time within the part) and records the sections seen. */
class Song {
  readonly tracker = new SectionTracker();
  readonly visited: Section[] = [];
  t = 0;

  play(seconds: number, input: SectionInput | ((elapsed: number) => SectionInput)): this {
    for (let elapsed = 0; elapsed < seconds; elapsed += STEP) {
      const beatHit = Math.floor((this.t + STEP) / BEAT_SEC) > Math.floor(this.t / BEAT_SEC);
      this.t += STEP;
      const frame = typeof input === 'function' ? input(elapsed) : input;
      const section = this.tracker.update(STEP, { ...frame, beatHit });
      if (this.visited.at(-1) !== section) this.visited.push(section);
    }
    return this;
  }
}

describe('SectionTracker', () => {
  it('is quiet without a signal and grooves once the bass plays', () => {
    const song = new Song().play(1, SILENT).play(5, GROOVE);
    expect(song.visited).toEqual(['quiet', 'groove']);
  });

  it('follows a breakdown, build and drop', () => {
    const rising = (elapsed: number): SectionInput => ({ ...NO_BASS, highDb: -48 + elapsed * 2 });
    const song = new Song()
      .play(20, GROOVE)
      .play(6, NO_BASS) // breakdown
      .play(6, rising) // risers and snare rolls: +12 dB
      .play(12, GROOVE); // the drop, then back to groove
    expect(song.visited).toEqual(['groove', 'breakdown', 'build', 'drop', 'groove']);
  });

  it('recognises the drop within a quarter of a second', () => {
    const song = new Song().play(20, GROOVE).play(8, NO_BASS);
    let latencySec = 0;
    while (song.tracker.section !== 'drop' && latencySec < 2) {
      song.play(STEP, GROOVE);
      latencySec += STEP;
    }
    expect(song.tracker.section).toBe('drop');
    expect(latencySec).toBeLessThan(0.25);
  });

  it('a drop lasts about 16 beats', () => {
    const song = new Song().play(20, GROOVE).play(8, NO_BASS);
    let dropSec = 0;
    for (let i = 0; i < 20 * 60; i++) {
      song.play(STEP, GROOVE);
      if (song.tracker.section === 'drop') dropSec += STEP;
    }
    expect(dropSec).toBeGreaterThan(15 * BEAT_SEC);
    expect(dropSec).toBeLessThan(17 * BEAT_SEC);
  });

  it('does not mistake hats coming and going for a build', () => {
    // Measured through the real pipeline: off-beat hats make the highs swing between silence and
    // -60 dB every beat, which a short dB average turned into a false "rise".
    const hats = (elapsed: number): SectionInput => ({
      ...NO_BASS,
      highDb: (elapsed + BEAT_SEC / 2) % BEAT_SEC < 0.06 ? -60 : -120,
    });
    const song = new Song().play(20, GROOVE).play(10, hats);
    expect(song.visited).toEqual(['groove', 'breakdown']);
  });

  it('ignores a short bass gap (an EQ kill or a fill)', () => {
    const song = new Song().play(20, GROOVE).play(1.5, NO_BASS).play(10, GROOVE);
    expect(song.visited).toEqual(['groove']);
  });

  it('a short breakdown returns to the groove without a drop', () => {
    const song = new Song().play(20, GROOVE).play(3, NO_BASS).play(10, GROOVE);
    expect(song.visited).toEqual(['groove', 'breakdown', 'groove']);
  });

  it('does not mistake turning the volume down for a breakdown', () => {
    const quieter: SectionInput = { ...GROOVE, lowDb: -32, highDb: -52, loudnessDb: -26 };
    const song = new Song().play(20, GROOVE).play(20, quieter);
    expect(song.visited).toEqual(['groove']);
  });

  it('goes quiet when the signal stops', () => {
    expect(new Song().play(10, GROOVE).play(2, SILENT).visited.at(-1)).toBe('quiet');
  });
});
