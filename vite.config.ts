import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import removeConsole from 'vite-plugin-remove-console'
import type { Plugin } from 'vite'
import { GET as imagem } from './api/imagem'
import { GET as configOrg } from './api/config-org'

// Em dev, atende as funções de api/ como a Vercel faz em produção
function apiDev(): Plugin {
  const rotas: Record<string, (r: Request) => Promise<Response>> = {
    '/api/imagem': imagem,
    '/api/config-org': configOrg,
  }
  return {
    name: 'gitcalm-api-dev',
    configureServer(server) {
      for (const [rota, handler] of Object.entries(rotas)) {
        server.middlewares.use(rota, async (req, res) => {
          const headers = new Headers()
          for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v)
          const r = await handler(new Request(`http://localhost${req.originalUrl ?? req.url}`, { headers }))
          res.statusCode = r.status
          r.headers.forEach((v, k) => res.setHeader(k, v))
          res.end(Buffer.from(await r.arrayBuffer()))
        })
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Variáveis GITCALM_* do .env.local ficam disponíveis para as funções de api/ em dev
  for (const [k, v] of Object.entries(loadEnv(mode, process.cwd(), 'GITCALM_'))) process.env[k] ??= v
  return {
  plugins: [react(), removeConsole(), apiDev()],
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
}
})
