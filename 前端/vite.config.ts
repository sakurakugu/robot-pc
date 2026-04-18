import vue from '@vitejs/plugin-vue'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const currentDir = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(currentDir, './src'),
    },
  },
  server: {
    host: true,
    port: 5175,
    proxy: {
      '/api/v1': {
        target: 'http://127.0.0.1:9010',
        changeOrigin: true,
      },
      '/api/v1/web': {
        target: 'ws://127.0.0.1:9010',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
