// Cloudflare Worker "desa-api": pintu masuk semua API game.
//   /api/save         -> simpanan otomatis desa (save.js)
//   /api/slots[/N]    -> simpanan manual, 5 slot per pemain (slots.js)
//   /api/chat         -> ngobrol dengan warga lewat Claude (chat.js)
//   /api/chat/status  -> { llm: true|false } supaya game tahu Claude tersedia atau tidak
//
// Cara kerja Worker: Cloudflare memanggil `fetch(request, env, ctx)` untuk tiap request.
// `env` berisi binding dari wrangler.jsonc (HYPERDRIVE, CHAT_LIMITER, vars) dan secret (ANTHROPIC_API_KEY).
import { corsHeaders, jsonResponse, connect } from './http.js';
import { handleSave } from './save.js';
import { handleSlots } from './slots.js';
import { handleChat, chatEnabled } from './chat.js';

export default {
  async fetch(request, env, ctx) {
    const cors = corsHeaders(request, env);
    const json = jsonResponse(cors);

    // Preflight: browser bertanya dulu "boleh PUT dengan header X-Player-Id?"
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const { pathname } = new URL(request.url);
    if (pathname === '/api/chat/status') return json(200, { llm: chatEnabled(env) });
    const slotMatch = pathname.match(/^\/api\/slots(?:\/([^/]+))?$/);
    if (pathname !== '/api/save' && pathname !== '/api/chat' && !slotMatch) return json(404, { error: 'not_found' });

    const sql = connect(env);
    try {
      if (pathname === '/api/save') return await handleSave(request, sql, json);
      if (slotMatch) return await handleSlots(request, sql, json, slotMatch[1]);
      return await handleChat(request, env, sql, json);
    } catch (e) {
      console.error('[desa-api]', e.message);
      return json(503, { error: 'db_unavailable' });
    } finally {
      // tutup koneksi setelah respons terkirim, tanpa membuat pemain menunggu
      ctx.waitUntil(sql.end());
    }
  },
};
