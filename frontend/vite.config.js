import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  // Agar cocok dengan GitHub Pages
  base: '/aqm-umkt-dashboard/',

  server: {
    port: 3000
  }
})