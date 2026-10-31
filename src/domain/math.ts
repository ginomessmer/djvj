export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const clamp01 = (value: number): number => clamp(value, 0, 1);

/** 0 below `edge0`, 1 above `edge1`, smooth in between. */
export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

/** Smooth ease for x in 0..1. */
export const smoothstep01 = (x: number): number => x * x * (3 - 2 * x);

/** Fractional part, always in [0, 1) (also for negative numbers). */
export const fract = (x: number): number => x - Math.floor(x);

/** Wraps a phase difference into [-0.5, 0.5). */
export const wrapPhase = (x: number): number => fract(x + 0.5) - 0.5;
