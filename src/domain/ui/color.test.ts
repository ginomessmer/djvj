import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  ensureContrast,
  inkFor,
  isHexColor,
  parseHex,
  relativeLuminance,
  toHex,
} from './color';

describe('hex colours', () => {
  it('parses six-digit hex in any case and round-trips', () => {
    expect(parseHex('#FF2e97')).toEqual([255, 46, 151]);
    expect(toHex([255, 46, 151])).toBe('#ff2e97');
  });

  it('reads the short form that minified CSS uses', () => {
    expect(parseHex('#fff')).toEqual([255, 255, 255]);
    expect(parseHex('#0A5')).toEqual([0, 170, 85]);
    expect(isHexColor('#fff')).toBe(false); // stored accents are always six digits
    expect(ensureContrast('#00c8f0', '#fff', 4.5)).not.toBe('#ffffff');
  });

  it('rejects anything else', () => {
    for (const bad of ['', 'red', '#ff', '#12345', '#gggggg', 'ff2e97']) {
      expect(parseHex(bad), bad).toBeNull();
      expect(isHexColor(bad), bad).toBe(false);
    }
  });

  it('clamps channels when formatting', () => {
    expect(toHex([-5, 300, 127.6])).toBe('#00ff80');
  });
});

describe('contrastRatio', () => {
  it('matches the WCAG reference values', () => {
    expect(relativeLuminance([0, 0, 0])).toBe(0);
    expect(relativeLuminance([255, 255, 255])).toBeCloseTo(1, 5);
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
    expect(contrastRatio('#336699', '#336699')).toBe(1);
  });

  it('is symmetric and treats invalid colours as no contrast', () => {
    expect(contrastRatio('#123456', '#fedcba')).toBeCloseTo(contrastRatio('#fedcba', '#123456'));
    expect(contrastRatio('nope', '#ffffff')).toBe(1);
  });
});

describe('inkFor', () => {
  it('picks the text colour that reads better on the background', () => {
    expect(inkFor('#ffffff')).toBe('#000000');
    expect(inkFor('#000000')).toBe('#ffffff');
    expect(inkFor('#ffb020')).toBe('#000000');
    expect(inkFor('#1a237e')).toBe('#ffffff');
  });
});

describe('ensureContrast', () => {
  it('leaves a colour that already passes alone', () => {
    expect(ensureContrast('#ff2e97', '#16181f', 4.5)).toBe('#ff2e97');
  });

  it('lightens on a dark background and darkens on a light one', () => {
    const onDark = ensureContrast('#1a237e', '#16181f', 4.5);
    expect(contrastRatio(onDark, '#16181f')).toBeGreaterThanOrEqual(4.5);
    const onLight = ensureContrast('#a6e600', '#ffffff', 4.5);
    expect(contrastRatio(onLight, '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(relativeLuminance(parseHex(onLight) ?? [255, 255, 255])).toBeLessThan(
      relativeLuminance(parseHex('#a6e600') ?? [0, 0, 0]),
    );
  });

  it('keeps the hue family: the dominant channel stays dominant', () => {
    const fixed = parseHex(ensureContrast('#a6e600', '#ffffff', 4.5)) ?? [0, 0, 0];
    expect(fixed[1]).toBeGreaterThan(fixed[2]);
  });

  it('returns invalid input untouched', () => {
    expect(ensureContrast('nope', '#000000', 4.5)).toBe('nope');
  });
});
