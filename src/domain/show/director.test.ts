import { describe, expect, it } from 'vitest';
import { Director, type DirectorFrame, type DirectorInput, type DirectorOptions } from './director';
import { SCENES, type SceneId } from './scenes';

const STEP = 1 / 60;
const BEAT_SEC = 60 / 128;

type Conditions = Partial<Omit<DirectorInput, 'beat' | 'selectedId'>> & { locked?: boolean };

/** Drives a director at 60 fps with a 128 BPM beat, feeding the selection back like the runtime. */
class Show {
  readonly director: Director;
  readonly changes: Array<{ tSec: number; to: SceneId; brightness: number }> = [];
  selectedId: SceneId = 'tunnel';
  last!: DirectorFrame;
  t = 0;

  constructor(options: Partial<DirectorOptions> = {}) {
    this.director = new Director(this.selectedId, { rng: () => 0.5, ...options });
  }

  run(seconds: number, conditions: Conditions = {}): DirectorFrame {
    const { locked = true, ...rest } = conditions;
    const end = this.t + seconds;
    while (this.t < end - 1e-9) {
      const hit = Math.floor((this.t + STEP) / BEAT_SEC) > Math.floor(this.t / BEAT_SEC);
      this.t += STEP;
      this.last = this.director.update(STEP, {
        auto: true,
        panic: false,
        live: true,
        section: 'groove',
        energy: 0.7,
        ...rest,
        selectedId: this.selectedId,
        beat: { hit: locked && hit, locked },
      });
      if (this.last.selectedId !== this.selectedId) {
        this.changes.push({
          tSec: this.t,
          to: this.last.selectedId,
          brightness: this.last.brightness,
        });
        this.selectedId = this.last.selectedId;
      }
    }
    return this.last;
  }
}

const onBeat = (tSec: number) => (tSec / BEAT_SEC) % 1 < 1.5 * (STEP / BEAT_SEC);
const suits = (id: SceneId, energy: number) => {
  const [min, max] = SCENES.find((scene) => scene.id === id)?.energy ?? [0, 0];
  return energy >= min && energy <= max;
};

describe('Director', () => {
  it('shows the selected scene at full brightness', () => {
    expect(new Show().run(1)).toMatchObject({ shownId: 'tunnel', brightness: 1 });
  });

  it('panic shows the safe scene immediately at full brightness', () => {
    const show = new Show();
    show.run(1);
    expect(show.run(STEP, { panic: true })).toMatchObject({ shownId: 'ambient', brightness: 1 });
  });

  it('falls back to the idle scene on silence, but only in auto mode', () => {
    expect(new Show().run(2, { live: false }).shownId).toBe('fluid');
    expect(new Show().run(2, { live: false, auto: false }).shownId).toBe('tunnel');
  });

  it('changes scene every 64 beats in a groove, on the beat', () => {
    const show = new Show();
    show.run(64 * BEAT_SEC * 2.5);
    expect(show.changes).toHaveLength(2);
    expect(show.changes[0].tSec).toBeGreaterThanOrEqual(64 * BEAT_SEC - STEP);
    for (const change of show.changes) expect(onBeat(change.tSec)).toBe(true);
  });

  it('falls back to a timer without a beat grid', () => {
    const show = new Show();
    show.run(100, { locked: false });
    expect(show.changes).toHaveLength(2);
    expect(show.changes[0].tSec).toBeCloseTo(45, 0);
  });

  it('cuts to a peak scene the moment the drop hits', () => {
    const show = new Show();
    show.run(10, { section: 'build' });
    const changesBefore = show.changes.length;
    show.run(STEP, { section: 'drop' });
    expect(show.changes).toHaveLength(changesBefore + 1);
    const drop = show.changes.at(-1);
    expect(drop?.brightness).toBe(1); // a hard cut, no dip to black
    expect(suits(drop?.to as SceneId, 0.95)).toBe(true);
  });

  it('goes to a calm scene for a breakdown, on the next beat', () => {
    const show = new Show();
    show.run(10);
    show.run(BEAT_SEC * 1.2, { section: 'breakdown' });
    const breakdown = show.changes.at(-1);
    expect(breakdown && onBeat(breakdown.tSec)).toBe(true);
    expect(suits(breakdown?.to as SceneId, 0.25)).toBe(true);
  });

  it('waits a few beats before following a section change that comes right after a change', () => {
    const show = new Show();
    show.run(10, { section: 'build' });
    show.run(2 * BEAT_SEC, { section: 'drop' }); // cut
    const afterDrop = show.changes.length;
    show.run(4 * BEAT_SEC, { section: 'breakdown' });
    expect(show.changes).toHaveLength(afterDrop); // too soon
    show.run(4 * BEAT_SEC, { section: 'breakdown' });
    expect(show.changes).toHaveLength(afterDrop + 1);
  });

  it('never changes a locked scene', () => {
    const show = new Show();
    show.run(200, { auto: false, section: 'drop' });
    expect(show.changes).toHaveLength(0);
  });

  it('waits a full phrase after auto mode comes back', () => {
    const show = new Show();
    show.run(100, { auto: false });
    show.run(60 * BEAT_SEC);
    expect(show.changes).toHaveLength(0);
  });

  it('does not repeat the last scenes', () => {
    const show = new Show({ phraseBeats: 8, rng: Math.random });
    show.run(8 * BEAT_SEC * 60);
    const picks = show.changes.map((change) => change.to);
    for (let i = 2; i < picks.length; i++) {
      expect(picks[i]).not.toBe(picks[i - 1]);
      expect(picks[i]).not.toBe(picks[i - 2]);
    }
  });
});
