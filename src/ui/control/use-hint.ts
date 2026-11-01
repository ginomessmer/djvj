import { useEffect, useRef, useState } from 'preact/hooks';
import { hintOf } from '../components/hint';

/** The hint of whatever the pointer is over or keyboard focus is on inside the returned ref. */
export function useHint() {
  const root = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const show = (event: Event) => setCurrent(hintOf(event.target));
    const clear = () => setCurrent(null);
    element.addEventListener('pointerover', show);
    element.addEventListener('focusin', show);
    element.addEventListener('pointerleave', clear);
    element.addEventListener('focusout', clear);
    return () => {
      element.removeEventListener('pointerover', show);
      element.removeEventListener('focusin', show);
      element.removeEventListener('pointerleave', clear);
      element.removeEventListener('focusout', clear);
    };
  }, []);

  return { root, hint: current };
}
