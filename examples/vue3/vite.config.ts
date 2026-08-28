import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const exampleRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(exampleRoot, '../..');

/** 开发时直接 alias 到各包源码，改 packages/* 即可热更新 */
const alias = {
  '@threxus/core': path.resolve(repoRoot, 'packages/core/src/index.ts'),
  '@threxus/runtime': path.resolve(repoRoot, 'packages/runtime/src/index.ts'),
  '@threxus/three': path.resolve(repoRoot, 'packages/three/src/index.ts'),
  '@threxus/vue': path.resolve(repoRoot, 'packages/vue/src/index.ts'),
};

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias,
  },
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
});
