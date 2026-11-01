import { describe, expect, it } from 'vitest';
import { PaletteRotation } from './palette-rotation';

describe('PaletteRotation', () => {
  it('changes the palette on every drop', () => {
    const rotation = new PaletteRotation();
    expect(rotation.onSceneChange('drop')).toBe(true);
    expect(rotation.onSceneChange('drop')).toBe(true);
  });

  it('changes it every third phrase, counting from the last change', () => {
    const rotation = new PaletteRotation(3);
    expect(
      ['phrase', 'phrase', 'phrase', 'phrase'].map((r) => rotation.onSceneChange(r as 'phrase')),
    ).toEqual([false, false, true, false]);
    rotation.onSceneChange('drop');
    expect(rotation.onSceneChange('phrase')).toBe(false); // the drop restarted the count
  });

  it('keeps the palette for breakdowns and builds', () => {
    expect(new PaletteRotation(1).onSceneChange('section')).toBe(false);
  });
});
