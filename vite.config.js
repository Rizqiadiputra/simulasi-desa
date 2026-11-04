import { defineConfig, loadEnv } from 'vite';
import { chatApiPlugin } from './server/chatApi.js';

export default defineConfig(({ mode }) => {
  // Muat .env (termasuk ANTHROPIC_API_KEY) ke process.env untuk endpoint chat
  const env = loadEnv(mode, process.cwd(), '');
  for (const k of ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN']) if (env[k] && !process.env[k]) process.env[k] = env[k];
  return {
    // GitHub Pages project site: https://radiputra.biz.id/simulasi-desa/
    base: mode === 'production' ? '/simulasi-desa/' : '/',
    server: {
      host: true,
      port: 5173,
      // simpanan desa dilayani Cloudflare Worker lokal (cd worker && npm run dev)
      proxy: { '/api/save': 'http://localhost:8787' },
    },
    build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
    plugins: [chatApiPlugin()],
  };
});
