import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@threxus/runtime',
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
