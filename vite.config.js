import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://recargas-hulk-tawny.vercel.app',
        changeOrigin: true,
        secure: false,
      },
      '/proxy/bloodstrike': {
        target: 'https://pay.neteasegames.com/gameclub/bloodstrike/-1/login-role',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/proxy\/bloodstrike/, ''),
      }
    }
  }
})
