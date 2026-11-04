// /api/save: simpanan desa per pemain.
//   GET    -> { state } | 404 kalau belum ada
//   PUT    -> body = state JSON
//   DELETE -> hapus simpanan
// Setiap request wajib membawa header X-Player-Id (UUID yang dibuat browser).

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY = 5_000_000;

export async function handleSave(request, sql, json) {
  const player = request.headers.get('X-Player-Id') || '';
  if (!UUID_RE.test(player)) return json(400, { error: 'bad_player_id' });

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
}
