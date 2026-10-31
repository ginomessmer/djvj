import { defineConfig } from 'vitest/config';

// Three entry pages: a launcher, the fullscreen output (big screen) and the control panel (laptop).
export default defineConfig({
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        main: new URL('./index.html', import.meta.url).pathname,
        output: new URL('./output.html', import.meta.url).pathname,
        control: new URL('./control.html', import.meta.url).pathname,
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
