import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Khi chạy npm run dev, chuyển mọi request /api/... sang Flask backend
      '/api': 'http://127.0.0.1:5000',
    },
  },
})