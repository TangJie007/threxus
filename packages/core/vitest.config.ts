/**
 * Vitest 配置：直接测试 `src`，覆盖 Stage 3 装饰器路径。
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@threxus/core',
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
