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
    // 构建用无 paths 的 tsconfig，避免 d.ts 跟进源码路径映射
    tsconfigPath: './tsconfig.build.json',
  },
  output: {
    target: 'web',
    distPath: {
      root: 'dist',
    },
  },
});
