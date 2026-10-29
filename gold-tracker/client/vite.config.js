import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // In dev, price lookups go to the Express server (npm start in ../server).
    proxy: { '/api': 'http://localhost:4400' },
  },
})
