import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { openOutputWindow } from '@/services/output-window';

/** How long to wait for an already running output window to answer before opening a new one. */
const AUTO_OPEN_DELAY_MS = 1200;

/**
 * Opens the output window when the control window starts, unless one is already running (a
 * reload of the control window must not reload the output). Browsers only allow popups from a
 * click, so the automatic attempt can be blocked: then `blocked` is set and the UI asks for a
 * click instead.
 */
export function useOutputLauncher(connected: boolean) {
  const connectedRef = useRef(connected);
  connectedRef.current = connected;
  const [blocked, setBlocked] = useState(false);

  const open = useCallback(() => {
    const handle = openOutputWindow(connectedRef.current);
    setBlocked(handle === null);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!connectedRef.current) open();
    }, AUTO_OPEN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (connected) setBlocked(false);
  }, [connected]);

  return { open, blocked };
}
