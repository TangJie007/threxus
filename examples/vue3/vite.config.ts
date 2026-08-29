import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import babel, { type RolldownBabelPreset } from '@rolldown/plugin-babel';

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
 * 必须先跑 transform-typescript：去掉字段上的 `!`，再跑 decorators。
 * 否则 decorators 会给字段加 initializer，留下 `field!: T = init`，
 * Oxc 解析时报 Declarations with initializers cannot also have definite assignment assertions。
 *
 * @see https://vite.dev/guide/migration
 */
function decoratorPreset(options: Record<string, unknown>): RolldownBabelPreset {
  return {
    preset: () => ({
      plugins: [
        ['@babel/plugin-transform-typescript', { allowDeclareFields: true }],
        ['@babel/plugin-proposal-decorators', options],
      ],
    }),
    rolldown: {
      filter: {
        code: '@',
      },
    },
  } as RolldownBabelPreset;
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
