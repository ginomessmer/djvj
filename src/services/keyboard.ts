/** Input types where keys do not type anything, so shortcuts may still work there. */
const NON_TYPING_INPUTS = new Set([
  'range',
  'checkbox',
  'radio',
  'button',
  'submit',
  'file',
  'color',
]);

interface KeyTarget {
  tagName?: string;
  type?: string;
  isContentEditable?: boolean;
}

/** Whether a key pressed on `target` is typing (a name, a search) rather than a shortcut. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as KeyTarget | null;
  if (!element?.tagName) return false;
  if (element.isContentEditable) return true;
  const tag = element.tagName.toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return tag === 'INPUT' && !NON_TYPING_INPUTS.has((element.type ?? 'text').toLowerCase());
}

/**
 * Calls `handler` with the lower-cased key for plain key presses (no Cmd/Ctrl/Alt), unless they
 * are typed into a text field: typing a name like "Patrick" must not trigger panic.
 * @returns a function that stops listening
 */
export function onPlainKey(handler: (key: string) => void): () => void {
  const listener = (event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (isTypingTarget(event.target)) return;
    handler(event.key.toLowerCase());
  };
  window.addEventListener('keydown', listener);
  return () => window.removeEventListener('keydown', listener);
}

export function toggleFullscreen(): void {
  if (document.fullscreenElement) {
    void document.exitFullscreen();
  } else {
    void document.documentElement.requestFullscreen().catch(() => undefined);
  }
}
