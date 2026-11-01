interface WelcomeProps {
  /** The browser refused the automatic popup: a click is needed. */
  blocked: boolean;
  onOpenOutput: () => void;
}

/** Shown until an output window answers: the start-up steps that used to live on the landing page. */
export function Welcome({ blocked, onOpenOutput }: WelcomeProps) {
  return (
    <section class="welcome" aria-labelledby="welcome-title">
      <h2 id="welcome-title">Let’s get the big screen going</h2>
      <p class="hint">Automated, audio-reactive visuals for your set. Runs locally, offline.</p>
      <button type="button" class="primary welcome__cta" onClick={onOpenOutput}>
        Open output window <kbd>O</kbd>
      </button>
      {blocked && (
        <p class="notice notice--warn" role="alert">
          Your browser blocked the automatic popup. Click the button above, or allow pop-ups for
          this site to have it open by itself next time.
        </p>
      )}
      <ol class="steps">
        <li>
          Drag the output window onto the <b>big screen</b>.
        </li>
        <li>
          Click once inside it to allow <b>audio input</b>, then press <kbd>F</kbd> for fullscreen.
        </li>
        <li>
          Pick the audio source here: the built-in mic, a USB interface, or BlackHole. No audio yet?
          Press <kbd>M</kbd> for a simulated demo signal.
        </li>
      </ol>
      <p class="hint">
        Use Chrome. Press <kbd>?</kbd> any time to see the keyboard shortcuts.
      </p>
    </section>
  );
}
