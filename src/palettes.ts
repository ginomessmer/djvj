export interface Palette {
  id: string;
  name: string;
  /** Four colours the shaders blend between (see `pal()` in the shader header). */
  colors: readonly [string, string, string, string];
}

export const PALETTES: readonly Palette[] = [
  { id: 'synthwave', name: 'Synthwave', colors: ['#ff2e97', '#8a2be2', '#00e5ff', '#1a0b3d'] },
  { id: 'acid', name: 'Acid', colors: ['#c6ff00', '#00e676', '#00b0ff', '#0a1f12'] },
  { id: 'ember', name: 'Ember', colors: ['#ff3d00', '#ffab00', '#ff1744', '#1c0a05'] },
  { id: 'ice', name: 'Ice', colors: ['#e0f7fa', '#4fc3f7', '#7c4dff', '#08122b'] },
  { id: 'aurora', name: 'Aurora', colors: ['#00ffa3', '#03e1ff', '#dc1fff', '#050d1a'] },
  { id: 'mono', name: 'Mono', colors: ['#ffffff', '#9e9e9e', '#e0e0e0', '#050505'] },
];

export function findPalette(id: string): Palette {
  return PALETTES.find((p) => p.id === id) ?? (PALETTES[0] as Palette);
}

export function nextPalette(id: string): Palette {
  const i = PALETTES.findIndex((p) => p.id === id);
  return PALETTES[(i + 1) % PALETTES.length] as Palette;
}

/** "#rrggbb" -> [r, g, b] in 0..1 */
export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return [0, 0, 0];
  return [parseInt(m[1] as string, 16) / 255, parseInt(m[2] as string, 16) / 255, parseInt(m[3] as string, 16) / 255];
}

/** Flat vec3[4] for `gl.uniform3fv`. */
export function paletteToUniform(p: Palette): Float32Array {
  const out = new Float32Array(12);
  p.colors.forEach((hex, i) => out.set(hexToRgb(hex), i * 3));
  return out;
}
