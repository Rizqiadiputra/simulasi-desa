// /api/slots: simpanan manual (save slot) per pemain, terpisah dari simpanan otomatis di /api/save.
//   GET    /api/slots    -> { slots: [{ slot, name, summary, savedAt }] }  (tanpa state, supaya ringan)
//   GET    /api/slots/N  -> { state } | 404
//   PUT    /api/slots/N  -> body = { name, summary, state }
//   DELETE /api/slots/N
// N = 1..MAX_SLOTS. Header X-Player-Id wajib, sama seperti /api/save.

export const MAX_SLOTS = 5;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY = 5_000_000;

export async function handleSlots(request, sql, json, slotParam) {
  const player = request.headers.get('X-Player-Id') || '';
  if (!UUID_RE.test(player)) return json(400, { error: 'bad_player_id' });

  // daftar slot
  if (slotParam === undefined) {
    if (request.method !== 'GET') return json(405, { error: 'method_not_allowed' });
    const rows = await sql`
      SELECT slot, name, summary, saved_at FROM save_slots
      WHERE player_id = ${player} ORDER BY slot`;
    return json(200, { slots: rows.map((r) => ({ slot: r.slot, name: r.name, summary: r.summary, savedAt: r.saved_at.getTime() })) });
  }

  const slot = Number(slotParam);
  if (!Number.isInteger(slot) || slot < 1 || slot > MAX_SLOTS) return json(400, { error: 'bad_slot' });

  if (request.method === 'GET') {
    const rows = await sql`SELECT state FROM save_slots WHERE player_id = ${player} AND slot = ${slot}`;
    return rows.length ? json(200, { state: rows[0].state }) : json(404, { error: 'not_found' });
  }

  if (request.method === 'PUT') {
    const text = await request.text();
    if (text.length > MAX_BODY) return json(413, { error: 'too_large' });
    let body;
    try { body = JSON.parse(text); } catch { return json(400, { error: 'bad_json' }); }
    const { state } = body || {};
    if (!state || typeof state.version !== 'number' || !state.clock) return json(400, { error: 'bad_state' });
    const name = String(body.name || `Slot ${slot}`).slice(0, 40);
    const summary = body.summary && typeof body.summary === 'object' ? body.summary : {};
    await sql`
      INSERT INTO save_slots (player_id, slot, name, summary, version, state, saved_at)
      VALUES (${player}, ${slot}, ${name}, ${sql.json(summary)}, ${state.version}, ${sql.json(state)}, now())
      ON CONFLICT (player_id, slot) DO UPDATE
        SET name = EXCLUDED.name, summary = EXCLUDED.summary, version = EXCLUDED.version,
            state = EXCLUDED.state, saved_at = now()`;
    return json(200, { ok: true });
  }

  if (request.method === 'DELETE') {
    await sql`DELETE FROM save_slots WHERE player_id = ${player} AND slot = ${slot}`;
    return json(200, { ok: true });
  }

  return json(405, { error: 'method_not_allowed' });
}
