interface StartOverlayProps {
  message: string;
  /** Omit when there is nothing to click (fatal error). */
  onStart?: () => void;
}

export function StartOverlay({ message, onStart }: StartOverlayProps) {
  return (
    <button type="button" class="overlay" onClick={onStart} disabled={!onStart}>
      <span class="overlay__panel">
        <strong class="overlay__title">djvj</strong>
        <span class="overlay__message">{message}</span>
        <span class="overlay__hint">
          Drag this window to the big screen, then <kbd>F</kbd> fullscreen.
          <br />
          <kbd>A</kbd> auto · <kbd>N</kbd> next scene · <kbd>C</kbd> palette · <kbd>B</kbd> blackout
          · <kbd>P</kbd> panic · <kbd>M</kbd> demo signal · <kbd>D</kbd> debug
        </span>
      </span>
    </button>
  );
}
