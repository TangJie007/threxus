import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const exampleRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(exampleRoot, '../..');

const alias = {
  threxus: path.resolve(repoRoot, 'packages/core/src/index.ts'),
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
