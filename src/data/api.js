// Alamat Cloudflare Worker (worker/). Dev: kosong -> '/api/...' di-proxy Vite ke wrangler dev.
// Produksi: VITE_API_BASE diisi di .github/workflows/deploy.yml.
export const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');
