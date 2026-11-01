/**
 * Marks an element with a one-line explanation. The status bar shows it while the pointer is over
 * the element or it has keyboard focus, as a desktop app does; screen readers get it as the
 * element's description. Use it in place of `title`, which would add a second, delayed tooltip.
 */
export function hint(text: string): { 'data-hint': string; 'aria-description': string } {
  return { 'data-hint': text, 'aria-description': text };
}

/** The nearest explanation at or above an element, or null. Used by the status bar. */
export function hintOf(target: EventTarget | null): string | null {
  const element = target as Partial<Element> | null;
  if (typeof element?.closest !== 'function') return null;
  return element.closest('[data-hint]')?.getAttribute('data-hint') ?? null;
}
