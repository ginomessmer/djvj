interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Visible on the right of the label, e.g. a key hint. */
  hint?: string;
}

/** A switch: one real checkbox with the `switch` role, so assistive tech announces on/off. */
export function Toggle({ label, checked, onChange, hint }: ToggleProps) {
  return (
    <label class="switch">
      <input
        type="checkbox"
        role="switch"
        aria-checked={checked}
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span class="switch__track" aria-hidden="true" />
      <span class="switch__label">{label}</span>
      {hint && <kbd>{hint}</kbd>}
    </label>
  );
}
