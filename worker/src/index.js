// Cloudflare Worker: API simpanan desa.
//   GET    /api/save  -> { state } | 404 kalau belum ada
//   PUT    /api/save  -> body = state JSON
//   DELETE /api/save  -> hapus simpanan
// Setiap request wajib membawa header X-Player-Id (UUID yang dibuat browser).
//
// Cara kerja Worker: Cloudflare memanggil `fetch(request, env, ctx)` untuk tiap request.
// `env` berisi binding dari wrangler.jsonc (env.HYPERDRIVE, env.ALLOWED_ORIGINS).
import postgres from 'postgres';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY = 5_000_000;

// CORS: game di radiputra.biz.id beda origin dengan Worker, jadi browser butuh izin eksplisit
function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim());
  return {
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0],
    'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Player-Id',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export default {
  async fetch(request, env, ctx) {
    const cors = corsHeaders(request, env);
    const json = (code, obj) => new Response(JSON.stringify(obj), { status: code, headers: { ...cors, 'Content-Type': 'application/json' } });

    // Preflight: browser bertanya dulu "boleh PUT dengan header X-Player-Id?"
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    if (url.pathname !== '/api/save') return json(404, { error: 'not_found' });

    const player = request.headers.get('X-Player-Id') || '';
    if (!UUID_RE.test(player)) return json(400, { error: 'bad_player_id' });

    // Hyperdrive memberi connection string yang sudah di-pool & di-cache dekat Worker.
    // Buat koneksi per request; Hyperdrive yang menjaga koneksi asli ke database tetap hangat.
    const sql = postgres(env.HYPERDRIVE.connectionString, { max: 5, fetch_types: false });

    try {
      if (request.method === 'GET') {
        const rows = await sql`SELECT state FROM saves WHERE player_id = ${player}`;
        return rows.length ? json(200, { state: rows[0].state }) : json(404, { error: 'not_found' });
      }

      if (request.method === 'PUT') {
        const text = await request.text();
        if (text.length > MAX_BODY) return json(413, { error: 'too_large' });
        let state;
        try { state = JSON.parse(text); } catch { return json(400, { error: 'bad_json' }); }
        if (!state || typeof state.version !== 'number' || !state.clock) return json(400, { error: 'bad_state' });
        const savedAt = new Date(state.clock.savedAt || Date.now());
        // Simpanan yang lebih lama (mis. dari tab lain) tidak boleh menimpa yang lebih baru
        await sql`
          INSERT INTO saves (player_id, version, state, saved_at)
          VALUES (${player}, ${state.version}, ${sql.json(state)}, ${savedAt})
          ON CONFLICT (player_id) DO UPDATE
            SET version = EXCLUDED.version, state = EXCLUDED.state,
                saved_at = EXCLUDED.saved_at, updated_at = now()
            WHERE saves.saved_at <= EXCLUDED.saved_at`;
        return json(200, { ok: true });
      }

      if (request.method === 'DELETE') {
        await sql`DELETE FROM saves WHERE player_id = ${player}`;
        return json(200, { ok: true });
      }

      return json(405, { error: 'method_not_allowed' });
    } catch (e) {
      console.error('[desa-api]', e.message);
      return json(503, { error: 'db_unavailable' });
    } finally {
      // tutup koneksi setelah respons terkirim, tanpa membuat pemain menunggu
      ctx.waitUntil(sql.end());
    }
  },
};
