import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://0.0.0.0:8001',
      // '/api/admin-content.php': {
      //   target: 'http://127.0.0.1:8001',
      //   changeOrigin: true,
      // },
      //  '/api/envcheck.php': {
      //   target: 'http://127.0.0.1:8001',
      //   changeOrigin: true,
      // },
    },
  },
})
