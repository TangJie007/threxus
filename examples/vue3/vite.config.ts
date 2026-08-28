import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const exampleRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(exampleRoot, '../..');
/** 直接吃 core 源码，改 packages/core/src 即可热更新，不必等 rslib dist */
const coreEntry = path.resolve(repoRoot, 'packages/core/src/index.ts');

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@threxus/core': coreEntry,
    },
  },
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
});
