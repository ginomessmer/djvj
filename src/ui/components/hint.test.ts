import { describe, expect, it } from 'vitest';
import { hint, hintOf } from './hint';

describe('hint', () => {
  it('sets both the status-bar text and the accessible description', () => {
    expect(hint('Fade to black')).toEqual({
      'data-hint': 'Fade to black',
      'aria-description': 'Fade to black',
    });
  });
});

describe('hintOf', () => {
  const element = (text: string | null) => ({
    closest: () => (text === null ? null : { getAttribute: () => text }),
  });

  it('reads the nearest hint', () => {
    expect(hintOf(element('Lock Tunnel') as unknown as EventTarget)).toBe('Lock Tunnel');
  });

  it('is null without a hint or without an element', () => {
    expect(hintOf(element(null) as unknown as EventTarget)).toBeNull();
    expect(hintOf(null)).toBeNull();
  });
});
