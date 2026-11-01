import { describe, expect, it } from 'vitest';
import { wrapPhase } from '../math';
import { RhythmTracker } from './rhythm-tracker';
import { type Frame, kickTrain, silence } from './test-signals';

const BPM = 128;
const BEAT_SEC = 60 / BPM;

function track(frames: Frame[], tracker = new RhythmTracker(), offsetSec = 0) {
  return frames.map(({ tSec, features }) => ({
    tSec,
    ...tracker.update(tSec, features, offsetSec),
  }));
}

/** Signed distance (seconds) of each beat from the nearest kick of a grid through `kickSec`. */
function beatErrors(states: ReturnType<typeof track>, kickSec: number, fromSec: number): number[] {
  return states
    .filter((state) => state.beatHit && state.tSec >= fromSec)
    .map((state) => wrapPhase((state.tSec - kickSec) / BEAT_SEC) * BEAT_SEC);
}

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const ONE_FRAME = 1 / 60;

describe('RhythmTracker', () => {
  it.each([120, 126, 128, 132, 138, 145, 150])(
    'reports %i BPM to a tenth, even with frame jitter and an off-beat bass',
    (bpm) => {
      const frames = kickTrain({ bpm, seconds: 14, jitter: true, offBeatStrength: 1 });
      const final = track(frames).at(-1);
      expect(Math.abs((final?.bpm ?? 0) - bpm)).toBeLessThan(0.1);
    },
  );

  it('follows a tempo change to a tenth', () => {
    const tracker = new RhythmTracker();
    track(kickTrain({ bpm: 128, seconds: 12 }), tracker);
    const final = track(kickTrain({ bpm: 132, seconds: 14, startSec: 12 }), tracker).at(-1);
    expect(Math.abs((final?.bpm ?? 0) - 132)).toBeLessThan(0.1);
  });

  it('puts its beats on the kicks', () => {
    const states = track(kickTrain({ bpm: BPM, seconds: 14, firstKickSec: 0.3 }));
    const errors = beatErrors(states, 0.3, 8);
    expect(errors.length).toBeGreaterThanOrEqual(12); // 6 s at 128 BPM is ~12.8 beats
    expect(errors.length).toBeLessThanOrEqual(13);
    for (const error of errors) expect(Math.abs(error)).toBeLessThan(2 * ONE_FRAME);
    expect(states.at(-1)?.confidence).toBeGreaterThan(0.5);
  });

  it('locks onto the kick, not an off-beat bass that looks just as strong in the low end', () => {
    // Measured through the real pipeline: equal low-end flux, but the kick punches harder.
    const states = track(
      kickTrain({ bpm: BPM, seconds: 14, firstKickSec: 0.3, offBeatStrength: 1 }),
    );
    const errors = beatErrors(states, 0.3, 8);
    for (const error of errors) expect(Math.abs(error)).toBeLessThan(2 * ONE_FRAME);
  });

  it('does not flip-flop between two clusters it cannot tell apart', () => {
    const frames = kickTrain({ bpm: BPM, seconds: 20, offBeatStrength: 1, offBeatPunch: 0.7 });
    const beats = track(frames).filter((state) => state.beatHit && state.tSec > 8);
    const gaps = beats.slice(1).map((beat, i) => beat.tSec - beats[i].tSec);
    expect(Math.min(...gaps)).toBeGreaterThan(0.9 * BEAT_SEC);
    expect(beats.length).toBeGreaterThanOrEqual(25); // 12 s at 128 BPM is ~25.6 beats
    expect(beats.length).toBeLessThanOrEqual(26);
  });

  it('re-aligns when the music comes back out of phase', () => {
    const tracker = new RhythmTracker();
    track(kickTrain({ bpm: BPM, seconds: 10 }), tracker);
    track(silence(2, 10, true), tracker);
    const shiftedKick = 12 + 0.4 * BEAT_SEC; // 0.4 of a beat later than the old grid
    const states = track(
      kickTrain({ bpm: BPM, seconds: 10, startSec: 12, firstKickSec: shiftedKick }),
      tracker,
    );
    const errors = beatErrors(states, shiftedKick, 17);
    expect(errors.length).toBeGreaterThan(8);
    for (const error of errors) expect(Math.abs(error)).toBeLessThan(2 * ONE_FRAME);
  });

  it('shows beats earlier by the latency offset', () => {
    const offsetSec = 0.05;
    const states = track(
      kickTrain({ bpm: BPM, seconds: 14, firstKickSec: 0.3 }),
      new RhythmTracker(),
      offsetSec,
    );
    expect(mean(beatErrors(states, 0.3, 8))).toBeCloseTo(-offsetSec, 1);
  });

  it('pulses on the beat and is quiet in between', () => {
    const states = track(kickTrain({ bpm: BPM, seconds: 12 })).filter((state) => state.tSec > 8);
    for (const state of states.filter((s) => s.beatHit))
      expect(state.beatPulse).toBeGreaterThan(0.8);
    // halfway between beats (120 ms decay: ~0.17 at half a beat of 128 BPM)
    for (const state of states.filter((s) => s.beatPhase > 0.45 && s.beatPhase < 0.55)) {
      expect(state.beatPulse).toBeLessThan(0.2);
    }
  });

  it('takes a tapped tempo and phase when there is no kick at all', () => {
    const tracker = new RhythmTracker();
    track(silence(4, 0, true), tracker);
    const tapSec = [4, 4 + BEAT_SEC, 4 + 2 * BEAT_SEC, 4 + 3 * BEAT_SEC];
    for (const t of tapSec) tracker.tap(t);
    const states = track(silence(6, 4 + 3 * BEAT_SEC, true), tracker);
    const last = states.at(-1);
    expect(last?.source).toBe('tap');
    expect(Math.abs((last?.bpm ?? 0) - 128)).toBeLessThan(0.5);
    expect(last?.confidence).toBeGreaterThanOrEqual(0.8);
    const errors = beatErrors(states, tapSec[0], 5);
    for (const error of errors) expect(Math.abs(error)).toBeLessThan(2 * ONE_FRAME);
  });

  it('keeps a tapped grid on the kick even where the off-beat is louder, until cleared', () => {
    const tracker = new RhythmTracker();
    // the off-beat punches harder: on its own the tracker would lock onto it
    const frames = kickTrain({
      bpm: BPM,
      seconds: 16,
      firstKickSec: 0.3,
      offBeatStrength: 1,
      offBeatPunch: 0.9,
    });
    track(
      frames.filter((frame) => frame.tSec < 4),
      tracker,
    );
    for (let i = 0; i < 4; i++) tracker.tap(0.3 + (8 + i) * BEAT_SEC);
    const states = track(
      frames.filter((frame) => frame.tSec >= 4),
      tracker,
    );
    for (const error of beatErrors(states, 0.3, 8))
      expect(Math.abs(error)).toBeLessThan(2 * ONE_FRAME);

    tracker.clearTap();
    const after = track(
      kickTrain({ bpm: BPM, seconds: 1, startSec: 16, firstKickSec: 0.3 }),
      tracker,
    );
    expect(after.at(-1)?.source).toBe('auto');
  });

  it('loses confidence when the kick stops, and keeps counting beats', () => {
    const tracker = new RhythmTracker();
    track(kickTrain({ bpm: BPM, seconds: 10 }), tracker);
    const states = track(silence(10, 10, true), tracker);
    expect(states.at(-1)?.confidence).toBeLessThan(0.3);
    expect(states.filter((state) => state.beatHit).length).toBeGreaterThan(15); // free-running
  });
});
