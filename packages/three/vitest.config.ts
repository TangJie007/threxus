import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@threxus/three',
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
