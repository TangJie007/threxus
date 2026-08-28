import { defineConfig } from '@rslib/core';

export default defineConfig({
  lib: [
    {
      format: 'esm',
      bundle: true,
      dts: true,
      // 依赖保持 external，由消费方打包时对 es-toolkit 做 tree-shake
      autoExternal: true,
    },
  ],
  source: {
    entry: {
      index: './src/index.ts',
    },
  },
  output: {
    target: 'web',
    distPath: {
      root: 'dist',
    },
  },
});
