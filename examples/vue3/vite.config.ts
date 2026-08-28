import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import babel from '@rolldown/plugin-babel';

const exampleRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(exampleRoot, '../..');

/** 开发时直接 alias 到各包源码，改 packages/* 即可热更新 */
const alias = {
  '@threxus/core': path.resolve(repoRoot, 'packages/core/src/index.ts'),
  '@threxus/runtime': path.resolve(repoRoot, 'packages/runtime/src/index.ts'),
  '@threxus/three': path.resolve(repoRoot, 'packages/three/src/index.ts'),
  '@threxus/vue': path.resolve(repoRoot, 'packages/vue/src/index.ts'),
};

/**
 * Vite 8 / Oxc 尚不降级 TC39 Stage 3 decorators。
 * 仅对含 `@` 的文件走 Babel，与官方迁移指南一致。
 *
 * @see https://vite.dev/guide/migration
 */
function decoratorPreset(options: Record<string, unknown>) {
  return {
    preset: () => ({
      plugins: [['@babel/plugin-proposal-decorators', options]],
    }),
    rolldown: {
      filter: {
        code: '@',
      },
    },
  };
}

export default defineConfig({
  plugins: [
    vue(),
    babel({
      presets: [decoratorPreset({ version: '2023-11' })],
    }),
  ],
  resolve: {
    alias,
  },
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
});
