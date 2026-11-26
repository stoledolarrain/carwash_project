import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// En desarrollo, Vite reenvía /api al API Gateway: el navegador ve un solo origen y no hay problemas de CORS.
// En Docker, nginx hace lo mismo (ver nginx.conf).
export default defineConfig(({ mode }) => {
  const gateway = loadEnv(mode, '.', '').GATEWAY_URL || 'http://localhost:8080'
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': { target: gateway, changeOrigin: true },
      },
    },
  }
})
