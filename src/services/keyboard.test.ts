import { describe, expect, it } from 'vitest';
import { isTypingTarget } from './keyboard';

describe('isTypingTarget', () => {
  it('treats text fields as typing, so shortcuts do not fire there', () => {
    expect(isTypingTarget({ tagName: 'INPUT', type: 'text' } as unknown as EventTarget)).toBe(true);
    expect(isTypingTarget({ tagName: 'INPUT' } as unknown as EventTarget)).toBe(true); // defaults to text
    expect(isTypingTarget({ tagName: 'TEXTAREA' } as unknown as EventTarget)).toBe(true);
    expect(isTypingTarget({ tagName: 'SELECT' } as unknown as EventTarget)).toBe(true);
    expect(
      isTypingTarget({ tagName: 'DIV', isContentEditable: true } as unknown as EventTarget),
    ).toBe(true);
  });

  it('lets shortcuts through everywhere else', () => {
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget({ tagName: 'BODY' } as unknown as EventTarget)).toBe(false);
    expect(isTypingTarget({ tagName: 'BUTTON' } as unknown as EventTarget)).toBe(false);
    expect(isTypingTarget({ tagName: 'INPUT', type: 'range' } as unknown as EventTarget)).toBe(
      false,
    );
    expect(isTypingTarget({ tagName: 'INPUT', type: 'checkbox' } as unknown as EventTarget)).toBe(
      false,
    );
  });
});
