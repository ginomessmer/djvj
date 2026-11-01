import { describe, expect, it, vi } from 'vitest';
import { installNativeShell, isEditable } from './native-shell';

/** The tests run in node: a stand-in that only knows what the module asks of an element. */
class FakeElement {
  constructor(private readonly editable: boolean) {}
  closest(): FakeElement | null {
    return this.editable ? this : null;
  }
}

describe('isEditable', () => {
  it('is false without a target', () => {
    expect(isEditable(null)).toBe(false);
  });

  it('is true inside a text field and false elsewhere', () => {
    expect(isEditable(new FakeElement(true) as unknown as EventTarget)).toBe(true);
    expect(isEditable(new FakeElement(false) as unknown as EventTarget)).toBe(false);
  });
});

describe('installNativeShell', () => {
  function fakeDocument() {
    const listeners = new Map<string, (event: unknown) => void>();
    const doc = {
      addEventListener: (type: string, listener: (event: unknown) => void) =>
        listeners.set(type, listener),
      removeEventListener: (type: string) => listeners.delete(type),
    };
    return { doc: doc as unknown as Document, listeners };
  }

  it('blocks the browser menu on the window but not in a text field', () => {
    const { doc, listeners } = fakeDocument();
    installNativeShell(doc);

    const onChrome = { target: new FakeElement(false), preventDefault: vi.fn() };
    listeners.get('contextmenu')?.(onChrome);
    expect(onChrome.preventDefault).toHaveBeenCalled();

    const inField = { target: new FakeElement(true), preventDefault: vi.fn() };
    listeners.get('contextmenu')?.(inField);
    expect(inField.preventDefault).not.toHaveBeenCalled();
  });

  it('removes what it installed', () => {
    const { doc, listeners } = fakeDocument();
    installNativeShell(doc)();
    expect(listeners.size).toBe(0);
  });
});
