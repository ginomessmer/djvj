import { fileURLToPath } from 'node:url';
import preact from '@preact/preset-vite';
import { defineConfig } from 'vitest/config';

const path = (relative: string): string => fileURLToPath(new URL(relative, import.meta.url));

// One page, two views (see src/app/main.ts): the control panel and the output popup it opens.
export default defineConfig({
  plugins: [preact()],
  resolve: { alias: { '@': path('./src') } },
  build: { target: 'es2022' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Only the theme tokens are read as text (contrast test); other CSS stays unprocessed.
    css: { include: [/themes\.css/] },
  },
});
