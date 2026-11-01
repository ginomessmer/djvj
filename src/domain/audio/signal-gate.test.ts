import { describe, expect, it } from 'vitest';
import { SignalGate } from './signal-gate';

const FRAME_SEC = 1 / 60;

function feed(gate: SignalGate, levelDb: number, seconds: number): void {
  for (let frame = 0; frame < seconds * 60; frame++) gate.update(levelDb, FRAME_SEC);
}

describe('SignalGate', () => {
  it('needs a moment of signal to switch on', () => {
    const gate = new SignalGate();
    feed(gate, -20, 0.1);
    expect(gate.present).toBe(false);
    feed(gate, -20, 1);
    expect(gate.present).toBe(true);
  });

  it('holds through a short gap and switches off after sustained silence', () => {
    const gate = new SignalGate();
    feed(gate, -20, 2);
    feed(gate, -80, 1);
    expect(gate.present).toBe(true);
    feed(gate, -80, 4);
    expect(gate.present).toBe(false);
  });

  it('respects a changed threshold', () => {
    const gate = new SignalGate();
    gate.setThreshold(-30);
    feed(gate, -40, 2);
    expect(gate.present).toBe(false);
  });
});
