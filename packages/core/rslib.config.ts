import { defineConfig } from '@rslib/core';

export default defineConfig({
  lib: [
    {
      format: 'esm',
      bundle: true,
      dts: true,
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
