import { useState } from 'preact/hooks';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (value: number) => string;
  onInput: (value: number) => void;
}

/**
 * While dragging it shows its own value: snapshots from the output window lag a few frames behind
 * and would otherwise make the thumb jitter.
 */
export function Slider({ label, value, min, max, step, format, onInput }: SliderProps) {
  const [dragValue, setDragValue] = useState<number | null>(null);
  const shown = dragValue ?? value;

  return (
    <label class="field">
      <span class="field__label">
        {label}
        {format && <output>{format(shown)}</output>}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={shown}
        onInput={(event) => {
          const next = Number(event.currentTarget.value);
          setDragValue(next);
          onInput(next);
        }}
        onChange={() => setDragValue(null)}
      />
    </label>
  );
}
