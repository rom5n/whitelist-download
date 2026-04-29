import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/statistic': 'http://localhost:55000',
      '/sub-link': 'http://localhost:55000',
    }
  },
  build: {
    outDir: '../backend/http/dist',
    emptyOutDir: true,
  }
})