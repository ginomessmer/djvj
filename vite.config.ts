import { fileURLToPath } from 'node:url';
import preact from '@preact/preset-vite';
import { defineConfig } from 'vitest/config';

const path = (relative: string): string => fileURLToPath(new URL(relative, import.meta.url));

// Three entry pages: a launcher, the fullscreen output (big screen) and the control panel (laptop).
export default defineConfig({
  plugins: [preact()],
  resolve: { alias: { '@': path('./src') } },
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        main: path('./index.html'),
        output: path('./output.html'),
        control: path('./control.html'),
      },
    },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
