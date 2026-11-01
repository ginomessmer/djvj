import { useState } from 'preact/hooks';
import { hint as hintProps } from './hint';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (value: number) => string;
  /** Explains what moving it does: a tooltip, and read out after the label. */
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
  const fill = max > min ? ((shown - min) / (max - min)) * 100 : 0;

  return (
    <label class="field" {...(hint ? hintProps(hint) : {})}>
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
        style={{ '--fill': `${fill.toFixed(1)}%` }}
        aria-valuetext={text}
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
