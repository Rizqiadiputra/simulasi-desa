// Simpan / muat state desa. Utama: Cloudflare Worker (worker/) -> PostgreSQL.
// localStorage tetap dipakai sebagai cadangan kalau Worker tidak bisa dihubungi.
import { SAVE_KEY, STATE_VERSION } from './config.js';
import { createInitialState } from './initialState.js';

import { API_BASE } from './api.js';

const API = `${API_BASE}/api/save`;
const PLAYER_KEY = 'desa-player-id';

// ID acak per browser, supaya tiap pemain punya desanya sendiri di database
function playerId() {
  try {
    let id = localStorage.getItem(PLAYER_KEY);
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(PLAYER_KEY, id); }
    return id;
  } catch { return null; }
}
const headers = (extra = {}) => ({ 'X-Player-Id': playerId() || '', ...extra });
let serverOk = true; // jadi false kalau server/DB tidak tersedia, supaya tidak terus mencoba

function loadLocal() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s.version === STATE_VERSION ? s : null;
  } catch (e) {
    console.warn('[desa] gagal memuat state lokal', e);
    return null;
  }
}

async function loadServer() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2000);
    const r = await fetch(API, { signal: ctrl.signal, headers: headers() });
    clearTimeout(t);
    if (r.status === 404) return null; // DB aktif, belum ada simpanan
    if (!r.ok) { serverOk = false; return null; }
    const { state } = await r.json();
    return state?.version === STATE_VERSION ? state : null;
  } catch {
    serverOk = false;
    return null;
  }
}

// Ambil simpanan terbaru dari server atau localStorage (dibandingkan lewat clock.savedAt)
export async function loadState() {
  const [remote, local] = [await loadServer(), loadLocal()];
  if (remote && local) return (local.clock.savedAt || 0) > (remote.clock.savedAt || 0) ? local : remote;
  return remote || local;
}

export function saveState(state) {
  state.clock.savedAt = Date.now();
  const json = JSON.stringify(state);
  let ok = false;
  try { localStorage.setItem(SAVE_KEY, json); ok = true; } catch (e) { /* penuh / diblokir */ }
  if (serverOk) {
    // keepalive supaya tetap terkirim saat halaman ditutup (batas ~64KB; kalau lebih, localStorage yang menyelamatkan)
    fetch(API, { method: 'PUT', headers: headers({ 'Content-Type': 'application/json' }), body: json, keepalive: json.length < 60000 })
      .then((r) => { if (r.status === 503) serverOk = false; })
      .catch(() => {});
  }
  return ok;
}

// Hapus simpanan otomatis di server & lokal (dipanggil sebelum reload saat "Mulai dari Awal").
// ID pemain dan slot simpanan manual sengaja TIDAK dihapus.
export async function clearSaves() {
  try { await fetch(API, { method: 'DELETE', headers: headers() }); } catch { /* abaikan */ }
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* abaikan */ }
}

// Jadikan `state` simpanan otomatis terbaru (server + lokal), lalu halaman di-reload untuk memuatnya.
export async function replaceState(state) {
  state.clock.savedAt = Date.now();
  const json = JSON.stringify(state);
  try { localStorage.setItem(SAVE_KEY, json); } catch (e) { /* abaikan */ }
  try { await fetch(API, { method: 'PUT', headers: headers({ 'Content-Type': 'application/json' }), body: json }); } catch { /* abaikan */ }
}

// ------------------------------------------------------------------ slot simpanan manual
// Utama di Worker (/api/slots). Kalau Worker tidak bisa dihubungi, pakai localStorage.
export const MAX_SLOTS = 5;
const SLOTS_API = `${API_BASE}/api/slots`;
const LOCAL_SLOTS = 'desa-slots-v1';

const readLocalSlots = () => { try { return JSON.parse(localStorage.getItem(LOCAL_SLOTS) || '{}'); } catch { return {}; } };
const writeLocalSlots = (o) => localStorage.setItem(LOCAL_SLOTS, JSON.stringify(o));

// Ringkasan untuk daftar slot, supaya tidak perlu mengunduh seluruh state
export const summarize = (state) => ({
  day: state.clock.day,
  minute: Math.floor(state.clock.minute),
  pop: state.citizens.length,
  kas: Math.round(state.economy?.kas ?? 0),
  player: state.player?.name || null,
});

async function slotFetch(path, opts = {}) {
  const r = await fetch(`${SLOTS_API}${path}`, { ...opts, headers: headers(opts.headers) });
  if (r.status === 503 || r.status === 404 && !path) throw new Error('server_unavailable');
  return r;
}

// -> { slots: [{ slot, name, summary, savedAt }], where: 'server' | 'lokal' }
export async function listSlots() {
  try {
    const r = await slotFetch('');
    if (r.ok) return { slots: (await r.json()).slots, where: 'server' };
  } catch { /* jatuh ke lokal */ }
  const local = readLocalSlots();
  const slots = Object.entries(local).map(([slot, v]) => ({ slot: Number(slot), name: v.name, summary: v.summary, savedAt: v.savedAt }));
  return { slots, where: 'lokal' };
}

export async function saveSlot(slot, name, state) {
  const body = { name, summary: summarize(state), state };
  try {
    const r = await slotFetch(`/${slot}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.ok) return 'server';
  } catch { /* jatuh ke lokal */ }
  const local = readLocalSlots();
  local[slot] = { ...body, savedAt: Date.now() };
  writeLocalSlots(local); // bisa melempar error kalau localStorage penuh
  return 'lokal';
}

export async function loadSlot(slot) {
  try {
    const r = await slotFetch(`/${slot}`);
    if (r.ok) return (await r.json()).state;
    if (r.status === 404) return null;
  } catch { /* jatuh ke lokal */ }
  return readLocalSlots()[slot]?.state || null;
}

export async function deleteSlot(slot) {
  try {
    const r = await slotFetch(`/${slot}`, { method: 'DELETE' });
    if (r.ok) return;
  } catch { /* jatuh ke lokal */ }
  const local = readLocalSlots();
  delete local[slot];
  writeLocalSlots(local);
}

export function resetState() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* abaikan */ }
  return createInitialState();
}

export const exportState = (state) => JSON.stringify(state, null, 2);
