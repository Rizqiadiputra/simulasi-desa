// Helper bersama: CORS, respons JSON, dan koneksi Postgres lewat Hyperdrive.
import postgres from 'postgres';

// CORS: game di desa-budaya.pages.dev / radiputra.biz.id beda origin dengan Worker, jadi browser butuh izin eksplisit
export function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim());
  return {
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0],
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Player-Id',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export const jsonResponse = (cors) => (code, obj) =>
  new Response(JSON.stringify(obj), { status: code, headers: { ...cors, 'Content-Type': 'application/json' } });

// Hyperdrive memberi connection string yang sudah di-pool dekat Worker.
// Buat koneksi per request; tutup lewat ctx.waitUntil(sql.end()) setelah respons terkirim.
export const connect = (env) => postgres(env.HYPERDRIVE.connectionString, { max: 5, fetch_types: false });
