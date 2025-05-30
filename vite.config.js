import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  root: './src', // Указываем корневую папку
  server: {
    port: 5173,
    open: true
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.html')
      }
    }
  },
  envDir: '../'
})