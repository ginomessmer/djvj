import { describe, expect, it } from 'vitest';
import { Envelope } from './envelope';

describe('Envelope', () => {
  it('rises with the attack time and falls more slowly with the release time', () => {
    const envelope = new Envelope(50, 400);
    const afterOneFrame = envelope.update(1, 16);
    expect(afterOneFrame).toBeGreaterThan(0);
    expect(afterOneFrame).toBeLessThan(1);
    for (let i = 0; i < 120; i++) envelope.update(1, 16);
    expect(envelope.value).toBeGreaterThan(0.99);

    const peak = envelope.value;
    for (let i = 0; i < 10; i++) envelope.update(0, 16);
    // one-pole release: after 160 ms of a 400 ms time constant the value is e^(-160/400) of the peak
    expect(envelope.value).toBeCloseTo(peak * Math.exp(-160 / 400), 2);
  });

  it('jumps instantly when the attack time is zero', () => {
    expect(new Envelope(0, 100).update(1, 16)).toBe(1);
  });
});
