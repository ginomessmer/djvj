export interface Palette {
  id: string;
  name: string;
  /** Four colours the shaders blend between (`pal()` in the shader header). */
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
  return PALETTES.find((palette) => palette.id === id) ?? PALETTES[0];
}

export function nextPalette(id: string): Palette {
  const index = PALETTES.findIndex((palette) => palette.id === id);
  return PALETTES[(index + 1) % PALETTES.length];
}
