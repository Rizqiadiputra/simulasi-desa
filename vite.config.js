import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  // Cloudflare Pages (desa-budaya.pages.dev) melayani game di root: '/'.
  // GitHub Pages (radiputra.biz.id/simulasi-desa/) butuh BASE_PATH=/simulasi-desa/ (diset di workflow).
  base: mode === 'production' ? process.env.BASE_PATH || '/' : '/',
  server: {
    host: true,
    port: 5173,
    // semua API (simpanan + chat) dilayani Cloudflare Worker lokal: cd worker && npm run dev
    proxy: { '/api': 'http://localhost:8787' },
  },
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
}));
