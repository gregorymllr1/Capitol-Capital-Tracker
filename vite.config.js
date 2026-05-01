import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/house': {
        target: 'https://congressional-trading-datastore-production-9fd6.up.railway.app',
        changeOrigin: true,
        rewrite: (path) => path.replace('/api/house', '/api/v1/trades'),
      },
    },
  },
})
