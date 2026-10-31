import { describe, expect, it } from 'vitest';
import { AdaptiveRange, Envelope, OnsetDetector, SignalGate } from './dsp';

const FRAME = 1 / 60;

describe('Envelope', () => {
  it('rises with the attack time and falls more slowly with the release time', () => {
    const env = new Envelope(50, 400);
    const afterOne = env.update(1, 16);
    expect(afterOne).toBeGreaterThan(0);
    expect(afterOne).toBeLessThan(1);
    for (let i = 0; i < 120; i++) env.update(1, 16);
    expect(env.value).toBeGreaterThan(0.99);

    const peak = env.value;
    for (let i = 0; i < 10; i++) env.update(0, 16);
    expect(env.value).toBeLessThan(peak);
    // one-pole release: after 160 ms of a 400 ms time constant the value is e^(-160/400) of the peak
    expect(env.value).toBeCloseTo(peak * Math.exp(-160 / 400), 2);
  });

  it('jumps instantly when the attack time is zero', () => {
    expect(new Envelope(0, 100).update(1, 16)).toBe(1);
  });
});

describe('AdaptiveRange', () => {
  it('maps the recent quiet..loud range onto 0..1', () => {
    const range = new AdaptiveRange();
    let lowOut = 1;
    let highOut = 0;
    for (let i = 0; i < 600; i++) {
      const loud = i % 2 === 0;
      const out = range.normalize(loud ? -30 : -60, FRAME);
      if (i > 300) {
        if (loud) highOut = out;
        else lowOut = out;
      }
    }
    expect(highOut).toBeGreaterThan(0.95);
    expect(lowOut).toBeLessThan(0.05);
  });

  it('adapts when the input gets much louder (e.g. hotter line-in)', () => {
    const range = new AdaptiveRange();
    for (let i = 0; i < 600; i++) range.normalize(i % 2 === 0 ? -60 : -80, FRAME);
    let quiet = 1;
    let loud = 0;
    // two minutes of a much louder signal
    for (let i = 0; i < 60 * 120; i++) {
      const isLoud = i % 2 === 0;
      const out = range.normalize(isLoud ? -10 : -35, FRAME);
      if (i > 60 * 100) {
        if (isLoud) loud = out;
        else quiet = out;
      }
    }
    expect(loud).toBeGreaterThan(0.95);
    expect(quiet).toBeLessThan(0.1);
  });

  it('does not blow a constantly faint band up to full scale', () => {
    const range = new AdaptiveRange();
    let out = 1;
    for (let i = 0; i < 300; i++) out = range.normalize(-90, FRAME);
    expect(out).toBeLessThan(0.1);
  });

  it('survives non-finite input', () => {
    const range = new AdaptiveRange();
    expect(range.normalize(-Infinity, FRAME)).toBe(0);
    expect(range.normalize(NaN, FRAME)).toBe(0);
    expect(Number.isFinite(range.normalize(-30, FRAME))).toBe(true);
  });
});

describe('OnsetDetector', () => {
  it('fires once per pulse in a regular train', () => {
    const det = new OnsetDetector();
    let hits = 0;
    for (let i = 0; i < 600; i++) {
      const level = i % 30 < 3 ? 1 : 0.1; // a pulse every 0.5 s
      if (det.update(level, i * FRAME, FRAME)) hits++;
    }
    expect(hits).toBeGreaterThanOrEqual(19);
    expect(hits).toBeLessThanOrEqual(21);
  });

  it('stays quiet on a constant level', () => {
    const det = new OnsetDetector();
    let hits = 0;
    for (let i = 0; i < 600; i++) if (det.update(0.5, i * FRAME, FRAME) && i > 1) hits++;
    expect(hits).toBe(0);
  });
});

describe('SignalGate', () => {
  it('needs a moment of signal to switch on', () => {
    const gate = new SignalGate();
    for (let i = 0; i < 6; i++) gate.update(-20, FRAME);
    expect(gate.present).toBe(false);
    for (let i = 0; i < 60; i++) gate.update(-20, FRAME);
    expect(gate.present).toBe(true);
  });

  it('holds through a short gap and switches off after sustained silence', () => {
    const gate = new SignalGate();
    for (let i = 0; i < 120; i++) gate.update(-20, FRAME);
    for (let i = 0; i < 60; i++) gate.update(-80, FRAME); // 1 s gap
    expect(gate.present).toBe(true);
    for (let i = 0; i < 60 * 4; i++) gate.update(-80, FRAME);
    expect(gate.present).toBe(false);
  });

  it('respects a changed threshold', () => {
    const gate = new SignalGate();
    gate.setThreshold(-30);
    for (let i = 0; i < 120; i++) gate.update(-40, FRAME);
    expect(gate.present).toBe(false);
  });
});
