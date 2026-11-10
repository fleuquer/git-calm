import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import removeConsole from 'vite-plugin-remove-console'
import type { Plugin } from 'vite'
import { GET as imagem } from './api/imagem'

// Em dev, atende /api/imagem como a função da Vercel faz em produção
function apiImagemDev(): Plugin {
  return {
    name: 'gitcalm-api-imagem',
    configureServer(server) {
      server.middlewares.use('/api/imagem', async (req, res) => {
        const headers = new Headers()
        for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v)
        const r = await imagem(new Request(`http://localhost${req.originalUrl ?? req.url}`, { headers }))
        res.statusCode = r.status
        r.headers.forEach((v, k) => res.setHeader(k, v))
        res.end(Buffer.from(await r.arrayBuffer()))
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), removeConsole(), apiImagemDev()],
  base: '/',
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
