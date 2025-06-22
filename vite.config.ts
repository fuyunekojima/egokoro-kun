import { defineConfig } from 'vite'

export default defineConfig({
  root: 'src',
  base: process.env.GITHUB_PAGES ? '/egokoro-kun/' : '/',
  build: {
    outDir: '../dist',
    emptyOutDir: true
  },
  server: {
    port: 3000
  }
})