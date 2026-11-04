import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  // GitHub Pages project site: https://radiputra.biz.id/simulasi-desa/
  base: mode === 'production' ? '/simulasi-desa/' : '/',
  server: {
    host: true,
    port: 5173,
    // semua API (simpanan + chat) dilayani Cloudflare Worker lokal: cd worker && npm run dev
    proxy: { '/api': 'http://localhost:8787' },
  },
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
}));
