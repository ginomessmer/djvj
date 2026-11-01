import { useState } from 'preact/hooks';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (value: number) => string;
  /** Explains what moving it does; read out after the label. */
  hint?: string;
  onInput: (value: number) => void;
}

/**
 * While dragging it shows its own value: snapshots from the output window lag a few frames behind
 * and would otherwise make the thumb jitter.
 */
export function Slider({ label, value, min, max, step, format, hint, onInput }: SliderProps) {
  const [dragValue, setDragValue] = useState<number | null>(null);
  const shown = dragValue ?? value;
  const text = format?.(shown);

  return (
    <label class="field">
      <span class="field__label">
        {label}
        {text && <output>{text}</output>}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={shown}
        aria-valuetext={text}
        onInput={(event) => {
          const next = Number(event.currentTarget.value);
          setDragValue(next);
          onInput(next);
        }}
        onChange={() => setDragValue(null)}
      />
      {hint && <span class="field__hint">{hint}</span>}
    </label>
  );
}
