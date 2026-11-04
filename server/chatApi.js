// Endpoint dev server: POST /api/chat -> Claude (Messages API) memerankan warga desa.
// API key hanya dibaca di server (ANTHROPIC_API_KEY di .env), tidak pernah dikirim ke browser.
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-opus-5-5';
let client = null;
let disabled = false; // jadi true kalau kredensial tidak ada / ditolak

function getClient() {
  if (disabled) return null;
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) { disabled = true; return null; }
  client ||= new Anthropic();
  return client;
}

const clip = (s, n) => String(s ?? '').slice(0, n);

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 40000) reject(new Error('too large')); });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

const send = (res, code, obj) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); };

export function chatApiPlugin() {
  return {
    name: 'desa-chat-api',
    configureServer(server) {
      server.middlewares.use('/api/chat/status', (req, res) => send(res, 200, { llm: !!getClient(), model: MODEL }));
      server.middlewares.use('/api/chat', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        const api = getClient();
        if (!api) return send(res, 503, { error: 'llm_unavailable' });
        let body;
        try { body = await readBody(req); } catch { return send(res, 400, { error: 'bad_request' }); }
        const system = clip(body.system, 8000);
        // riwayat obrolan: maksimal 16 pesan terakhir, harus diawali pesan user
        let messages = (Array.isArray(body.messages) ? body.messages : [])
          .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content)
          .slice(-16)
          .map((m) => ({ role: m.role, content: clip(m.content, 600) }));
        while (messages.length && messages[0].role !== 'user') messages.shift();
        if (!messages.length) return send(res, 400, { error: 'no_messages' });
        try {
          const response = await api.beta.messages.create({
            model: MODEL,
            max_tokens: 4000,
            output_config: { effort: 'low' }, // obrolan santai: cepat & hemat
            betas: ['server-side-fallback-2026-07-01'],
            fallbacks: 'default',
            system,
            messages,
          });
          if (response.stop_reason === 'refusal') return send(res, 200, { reply: null, refused: true });
          const reply = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
          return send(res, 200, { reply, model: response.model });
        } catch (error) {
          if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
            disabled = true;
            console.warn('[desa-chat] kredensial ditolak, beralih ke otak lokal');
            return send(res, 503, { error: 'llm_unavailable' });
          }
          if (error instanceof Anthropic.RateLimitError) return send(res, 429, { error: 'rate_limited' });
          if (error instanceof Anthropic.APIError) { console.warn('[desa-chat]', error.status, error.message); return send(res, 502, { error: 'api_error' }); }
          console.warn('[desa-chat]', error);
          return send(res, 502, { error: 'network' });
        }
      });
    },
  };
}
