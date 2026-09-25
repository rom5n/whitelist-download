import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:55000',
      '/sub': 'http://localhost:55000',
    }
  },
  build: {
    outDir: '../backend/http/dist',
    emptyOutDir: true,
    // Flags stay separate files, fetched when shown, instead of being inlined into the bundle
    assetsInlineLimit: (file) => (file.includes('circle-flags') ? false : undefined),
  }
})