import { describe, expect, it } from 'vitest';

/**
 * The layers, from the bottom up. A layer may only import what is listed here: this keeps the
 * domain free of browser and framework code, and the UI free of business logic.
 */
const LAYER_RULES = {
  domain: { layers: [], packages: ['zod'] },
  services: { layers: ['domain'], packages: [] },
  vfx: { layers: ['domain'], packages: ['three'] },
  features: { layers: ['domain', 'services', 'vfx'], packages: ['zustand'] },
  ui: { layers: ['domain'], packages: ['preact'] },
  app: { layers: ['domain', 'services', 'vfx', 'features', 'ui'], packages: ['preact'] },
} as const;

type Layer = keyof typeof LAYER_RULES;

const sources = import.meta.glob('/src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Test files may use the test runner, whatever their layer. */
const isTestFile = (path: string): boolean => /\.test\.tsx?$|test-utils\.ts$/.test(path);

const IMPORT_PATTERN = /(?:from|import)\s+['"]([^'"]+)['"]/g;

function layerOf(path: string): Layer | null {
  const [, , layer] = path.split('/');
  return layer in LAYER_RULES ? (layer as Layer) : null;
}

function packageName(specifier: string): string {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

describe('architecture', () => {
  const files = Object.entries(sources).filter(([path]) => layerOf(path) !== null);

  it('finds the source files', () => {
    expect(files.length).toBeGreaterThan(40);
  });

  it.each(files)('%s only imports what its layer allows', (path, source) => {
    const layer = layerOf(path) as Layer;
    const rules = LAYER_RULES[layer];
    const violations: string[] = [];

    for (const [, specifier] of source.matchAll(IMPORT_PATTERN)) {
      if (specifier.startsWith('.') || specifier.startsWith('@/')) {
        const target = specifier.startsWith('@/')
          ? `/src/${specifier.slice(2)}`
          : new URL(specifier, `file://${path}`).pathname;
        const targetLayer = layerOf(`${target}.ts`);
        const allowed =
          targetLayer === layer ||
          (targetLayer && (rules.layers as readonly string[]).includes(targetLayer));
        if (!allowed) violations.push(`${specifier} (layer "${targetLayer}")`);
      } else if (specifier === 'vitest' && isTestFile(path)) {
      } else if (!(rules.packages as readonly string[]).includes(packageName(specifier))) {
        violations.push(`${specifier} (package not allowed in "${layer}")`);
      }
    }
    expect(violations).toEqual([]);
  });
});
