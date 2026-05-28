import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/git-calm/',
  server: {
    port: 5173,
    strictPort: false,
    host: true,
    open: false,
    proxy: {
      // Proxy para evitar CORS com a API do GitHub em dev
      '/github-proxy': {
        target: 'https://api.github.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/github-proxy/, ''),
        secure: true,
      },
    },
  },
  build: {
    target: 'esnext',
    minify: true,
    sourcemap: false,
  },
})
