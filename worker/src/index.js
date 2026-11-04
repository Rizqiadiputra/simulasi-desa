// Cloudflare Worker "desa-api": pintu masuk semua API game.
//   /api/save         -> simpanan desa (save.js)
//   /api/chat         -> ngobrol dengan warga lewat Claude (chat.js)
//   /api/chat/status  -> { llm: true|false } supaya game tahu Claude tersedia atau tidak
//
// Cara kerja Worker: Cloudflare memanggil `fetch(request, env, ctx)` untuk tiap request.
// `env` berisi binding dari wrangler.jsonc (HYPERDRIVE, CHAT_LIMITER, vars) dan secret (ANTHROPIC_API_KEY).
import { corsHeaders, jsonResponse, connect } from './http.js';
import { handleSave } from './save.js';
import { handleChat, chatEnabled } from './chat.js';

export default {
  async fetch(request, env, ctx) {
    const cors = corsHeaders(request, env);
    const json = jsonResponse(cors);

    // Preflight: browser bertanya dulu "boleh PUT dengan header X-Player-Id?"
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const { pathname } = new URL(request.url);
    if (pathname === '/api/chat/status') return json(200, { llm: chatEnabled(env) });
    if (pathname !== '/api/save' && pathname !== '/api/chat') return json(404, { error: 'not_found' });

    const sql = connect(env);
    try {
      return pathname === '/api/save'
        ? await handleSave(request, sql, json)
        : await handleChat(request, env, sql, json);
    } catch (e) {
      console.error('[desa-api]', e.message);
      return json(503, { error: 'db_unavailable' });
    } finally {
      // tutup koneksi setelah respons terkirim, tanpa membuat pemain menunggu
      ctx.waitUntil(sql.end());
    }
  },
};
