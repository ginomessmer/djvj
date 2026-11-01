import { describe, expect, it } from 'vitest';
import { contrastRatio } from '@/domain/ui/color';
import { THEMES } from '@/domain/ui/preferences';
import themesCss from './themes.css?raw';

type Tokens = Record<string, string>;

/** Reads the `--token: value;` pairs of every rule whose selector mentions the theme. */
function tokensOf(theme: string): Tokens {
  const tokens: Tokens = {};
  const rules = themesCss.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^}]*)\}/g);
  for (const [, selector, body] of rules) {
    const applies =
      selector.includes(`data-theme="${theme}"`) ||
      (theme === 'dark' && selector.includes(':root,'));
    if (!applies) continue;
    for (const [, name, value] of body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)) {
      tokens[name] = value.toLowerCase();
    }
  }
  return tokens;
}

describe.each(THEMES)('theme "%s"', (theme) => {
  const tokens = tokensOf(theme);
  const minText = theme === 'contrast' ? 7 : 4.5;
  const surfaces = ['bg', 'surface', 'surface-2'];

  it('defines every token', () => {
    for (const name of [
      'bg',
      'surface',
      'surface-2',
      'surface-3',
      'line',
      'edge',
      'text',
      'text-dim',
      'ok',
      'warn',
      'danger',
      'danger-ink',
    ]) {
      expect(tokens[name], name).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it.each(['text', 'text-dim', 'ok', 'warn', 'danger'])(
    '%s is readable on every surface',
    (name) => {
      for (const surface of surfaces) {
        expect(
          contrastRatio(tokens[name], tokens[surface]),
          `${name} on ${surface}`,
        ).toBeGreaterThanOrEqual(minText);
      }
    },
  );

  it('keeps text readable on the raised control background too', () => {
    expect(contrastRatio(tokens.text, tokens['surface-3'])).toBeGreaterThanOrEqual(minText);
  });

  it('draws control borders visibly against their surface', () => {
    expect(contrastRatio(tokens.edge, tokens.surface)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(tokens.edge, tokens['surface-2'])).toBeGreaterThanOrEqual(3);
  });

  it('puts readable text on a filled danger button', () => {
    expect(contrastRatio(tokens['danger-ink'], tokens.danger)).toBeGreaterThanOrEqual(4.5);
  });
});
