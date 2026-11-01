/** The output page is the same `index.html`, started in output mode. */
export const OUTPUT_VIEW_URL = '/?view=output';
const WINDOW_NAME = 'djvj-output';
const WINDOW_FEATURES = 'popup=yes,width=1280,height=720';

/**
 * Opens the output window, or focuses it. Must run from a click or key press, or the browser
 * blocks the popup.
 *
 * `exists` says whether an output window is known to be running. Then it is only brought to the
 * front: asking for the same URL again would reload it and drop its fullscreen and audio.
 * @returns the window, or null when the browser blocked the popup
 */
export function openOutputWindow(exists: boolean): Window | null {
  const handle = exists
    ? window.open('', WINDOW_NAME)
    : window.open(OUTPUT_VIEW_URL, WINDOW_NAME, WINDOW_FEATURES);
  handle?.focus();
  return handle;
}

/** Which page of the app this tab shows. Anything but `output` is the control view. */
export function currentView(search = window.location.search): 'control' | 'output' {
  return new URLSearchParams(search).get('view') === 'output' ? 'output' : 'control';
}
