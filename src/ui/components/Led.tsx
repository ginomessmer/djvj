interface LedProps {
  on: boolean;
  label: string;
}

export function Led({ on, label }: LedProps) {
  return (
    <span class="led-label">
      <span class={on ? 'led led--on' : 'led'} />
      {label}
    </span>
  );
}
