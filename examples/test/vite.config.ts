import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    // three 体积较大，单独拆包，利于长效缓存
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/three/examples')) return 'three-addons'
          if (id.includes('node_modules/three')) return 'three'
          return undefined
        },
      },
    },
    chunkSizeWarningLimit: 1500,
  },
})
