import { defineConfig } from 'vite'

export default defineConfig({
  root: 'src',
  base: process.env.NODE_ENV === 'production' ? '/egokoro-kun/' : '/',
  build: {
    outDir: '../dist',
    emptyOutDir: true
  },
  server: {
    port: 3000
  }
})