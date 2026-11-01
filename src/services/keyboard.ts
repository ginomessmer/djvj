/**
 * Calls `handler` with the lower-cased key for plain key presses (no Cmd/Ctrl/Alt) that are not
 * meant for a form control.
 * @returns a function that stops listening
 */
export function onPlainKey(handler: (key: string) => void): () => void {
  const listener = (event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target instanceof HTMLSelectElement) return;
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
