import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/** Port du serveur API Node (voir server/index.ts et scripts/dev.mjs). */
const API_PORT = process.env.API_PORT ?? '3001'

const apiProxy = {
  '/api': {
    target: `http://localhost:${API_PORT}`,
    changeOrigin: true,
  },
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // En développement, les appels /api sont relayés vers le serveur Prisma → Neon
  server: {
    proxy: apiProxy,
  },
  // `npm run preview` : même relais pour tester le build de production
  preview: {
    proxy: apiProxy,
  },
})
