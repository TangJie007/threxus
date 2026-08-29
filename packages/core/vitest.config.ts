import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'threxus',
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    environment: 'node',
  },
});
