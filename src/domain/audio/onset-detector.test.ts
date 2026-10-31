import { describe, expect, it } from 'vitest';
import { OnsetDetector } from './onset-detector';

const FRAME_SEC = 1 / 60;

describe('OnsetDetector', () => {
  it('fires once per pulse in a regular train', () => {
    const detector = new OnsetDetector();
    let hits = 0;
    for (let frame = 0; frame < 600; frame++) {
      const level = frame % 30 < 3 ? 1 : 0.1; // a pulse every 0.5 s
      if (detector.update(level, frame * FRAME_SEC, FRAME_SEC)) hits++;
    }
    expect(hits).toBeGreaterThanOrEqual(19);
    expect(hits).toBeLessThanOrEqual(21);
  });

  it('stays quiet on a constant level', () => {
    const detector = new OnsetDetector();
    let hits = 0;
    for (let frame = 0; frame < 600; frame++) {
      const hit = detector.update(0.5, frame * FRAME_SEC, FRAME_SEC);
      if (hit && frame > 1) hits++; // the very first frame jumps up from silence
    }
    expect(hits).toBe(0);
  });
});
