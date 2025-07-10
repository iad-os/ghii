/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/__test__/**/*.test.ts', 'src/__test__/**/*.test-d.ts'],
    coverage: {
      include: ['src/**/*.ts'],
      exclude: ['src/__test__/**/*'],
    },
  },
});
