interface LedProps {
  on: boolean;
  label: string;
}

/** The light is decoration; the state is in the text for screen readers. */
export function Led({ on, label }: LedProps) {
  return (
    <span class="led-label">
      <span class={on ? 'led led--on' : 'led'} aria-hidden="true" />
      {label}
      <span class="sr-only">{on ? ': on' : ': off'}</span>
    </span>
  );
}
