export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const clamp01 = (value: number): number => clamp(value, 0, 1);

/** Smooth ease for x in 0..1. */
export const smoothstep01 = (x: number): number => x * x * (3 - 2 * x);
