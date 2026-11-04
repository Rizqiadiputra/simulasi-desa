// /api/chat: Claude memerankan warga desa.
// API key disimpan sebagai secret Worker (ANTHROPIC_API_KEY), tidak pernah sampai ke browser.
//
// Pengaman biaya (prompt sistem datang dari browser, jadi endpoint ini bisa disalahgunakan):
//   1. Burst per IP  : binding Rate Limiting Cloudflare (CHAT_LIMITER, lihat wrangler.jsonc)
//   2. Harian per IP : tabel chat_usage, batas CHAT_DAILY_PER_IP
//   3. Harian global : tabel chat_usage, batas CHAT_DAILY_GLOBAL (rem darurat total biaya)
// Kalau salah satu habis -> 429, game otomatis pakai otak lokal.
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-opus-5-5';
const clip = (s, n) => String(s ?? '').slice(0, n);

export const chatEnabled = (env) => !!env.ANTHROPIC_API_KEY;

// Tambah 1 ke penghitung hari ini; kembalikan jumlah setelah ditambah
async function bump(sql, key) {
  const [row] = await sql`
    INSERT INTO chat_usage (day, key, count) VALUES (CURRENT_DATE, ${key}, 1)
    ON CONFLICT (day, key) DO UPDATE SET count = chat_usage.count + 1
    RETURNING count`;
  return row.count;
}

export async function handleChat(request, env, sql, json) {
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  if (!chatEnabled(env)) return json(503, { error: 'llm_unavailable' });

  const ip = request.headers.get('CF-Connecting-IP') || 'local';

  // 1. burst: beberapa pesan per menit per IP
  if (env.CHAT_LIMITER) {
    const { success } = await env.CHAT_LIMITER.limit({ key: ip });
    if (!success) return json(429, { error: 'rate_limited' });
  }

  let body;
  try { body = JSON.parse(await request.text()); } catch { return json(400, { error: 'bad_request' }); }
  const system = clip(body.system, 8000);
  // riwayat obrolan: maksimal 16 pesan terakhir, harus diawali pesan user
  const messages = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content)
    .slice(-16)
    .map((m) => ({ role: m.role, content: clip(m.content, 600) }));
  while (messages.length && messages[0].role !== 'user') messages.shift();
  if (!messages.length) return json(400, { error: 'no_messages' });

  // 2 & 3. kuota harian (dihitung sebelum memanggil Claude)
  const [perIp, global] = await Promise.all([bump(sql, `ip:${ip}`), bump(sql, 'global')]);
  if (perIp > Number(env.CHAT_DAILY_PER_IP) || global > Number(env.CHAT_DAILY_GLOBAL)) {
    return json(429, { error: 'quota_exceeded' });
  }

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: 'low' }, // obrolan santai: cepat & hemat
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system,
      messages,
    });
    if (response.stop_reason === 'refusal') return json(200, { reply: null, refused: true });
    const reply = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    return json(200, { reply, model: response.model });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      console.error('[desa-chat] kredensial ditolak');
      return json(503, { error: 'llm_unavailable' });
    }
    if (error instanceof Anthropic.RateLimitError) return json(429, { error: 'rate_limited' });
    if (error instanceof Anthropic.APIError) { console.error('[desa-chat]', error.status, error.message); return json(502, { error: 'api_error' }); }
    console.error('[desa-chat]', error);
    return json(502, { error: 'network' });
  }
}
