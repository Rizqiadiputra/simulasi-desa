// Simpan / muat state desa. Utama: Cloudflare Worker (worker/) -> PostgreSQL.
// localStorage tetap dipakai sebagai cadangan kalau Worker tidak bisa dihubungi.
import { SAVE_KEY, STATE_VERSION } from './config.js';
import { createInitialState } from './initialState.js';

// Dev: '/api/save' (di-proxy Vite ke wrangler dev). Produksi: isi VITE_SAVE_API dengan URL Worker.
const API = import.meta.env.VITE_SAVE_API || '/api/save';
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

// Hapus simpanan di server & lokal (dipanggil sebelum reload saat reset)
export async function clearSaves() {
  try { await fetch(API, { method: 'DELETE', headers: headers() }); } catch { /* abaikan */ }
  try { localStorage.clear(); } catch (e) { /* abaikan */ }
}

export function resetState() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* abaikan */ }
  return createInitialState();
}

export const exportState = (state) => JSON.stringify(state, null, 2);
